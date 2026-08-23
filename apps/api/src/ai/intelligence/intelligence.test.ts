import { describe, it, expect } from 'vitest';
import {
  categorizeError,
  fingerprintHash,
  normalizeConsoleMessage,
  normalizeErrorMessage,
  normalizePath,
  normalizeSelector,
  normalizeUrlForFingerprint,
} from './normalizers.js';
import { scoreSimilarity } from './similarityScorer.js';
import { generateCandidatePairs, blockingKeysFor } from './candidateBlocker.js';
import { UnionFind } from './unionFind.js';
import { clusterFingerprints } from './clusterer.js';
import { AiPairComparator } from './aiComparator.js';
import { FakeLLMProvider } from '../providers/fakeLLMProvider.js';
import { LLMProviderError } from '../providers/llmProvider.js';
import type { FailureFingerprint } from './intelligenceTypes.js';
import type { TestRunRecord } from '../../db/repositories/testRunRepo.js';

describe('normalizers', () => {
  it('strips UUIDs, timestamps, long numbers, hex, and ms', () => {
    const s = normalizeErrorMessage(
      'Timeout 5000ms exceeded at 2026-08-23T10:00:00Z locator #btn-12345 uuid=550e8400-e29b-41d4-a716-446655440000 addr=0xdeadbeef',
    );
    expect(s).toContain('timeout');
    expect(s).toContain('<ms>');
    expect(s).toContain('<time>');
    expect(s).toContain('<uuid>');
    expect(s).toContain('<hex>');
    expect(s).toContain('<n>');
  });

  it('normalizeUrl drops query/hash and normalizes path', () => {
    const r = normalizeUrlForFingerprint('http://a.test/orders/1234?token=xyz#top');
    expect(r.full).toBe('http://a.test/orders/1234');
    expect(r.path).toBe('/orders/:id');
  });

  it('normalizePath maps UUID and numeric segments to :id', () => {
    expect(normalizePath('/orders/550e8400-e29b-41d4-a716-446655440000')).toBe('/orders/:id');
    expect(normalizePath('/orders/42/items/7')).toBe('/orders/:id/items/:id');
  });

  it('normalizeSelector generalizes indices and dynamic ids', () => {
    expect(normalizeSelector('button:nth-child(3)')).toBe('button:nth-child(*)');
    expect(normalizeSelector('#user-1234567')).toBe('#<dyn>');
  });

  it('categorizeError classifies common shapes', () => {
    expect(categorizeError('TimeoutError', 'locator.click Timeout 5000ms exceeded')).toBe('timeout');
    expect(categorizeError('Error', 'net::ERR_FAILED')).toBe('network');
    expect(categorizeError('Error', 'HTTP 500 from POST /api/checkout')).toBe('http');
    expect(categorizeError('Error', 'Expected screen to contain "welcome"')).toBe('assertion');
    expect(categorizeError('TypeError', 'x is not a function')).toBe('javascript');
    expect(categorizeError('Error', 'page.goto failed navigation')).toBe('navigation');
  });

  it('fingerprintHash is deterministic', () => {
    expect(fingerprintHash(['a', 'b', 'c'])).toBe(fingerprintHash(['a', 'b', 'c']));
    expect(fingerprintHash(['a', 'b', 'c'])).not.toBe(fingerprintHash(['a', 'b', 'd']));
  });

  it('normalizeConsoleMessage is delegated to normalizeErrorMessage', () => {
    expect(normalizeConsoleMessage('Order 4567 failed at 2026-08-23T10:00:00Z')).toContain('<n>');
  });
});

function fp(over: Partial<FailureFingerprint>): FailureFingerprint {
  return {
    testRunId: 'r1',
    externalTestId: 't1',
    testName: 'test',
    classification: 'unknown',
    severity: 'unknown',
    failedStepIndex: null,
    actionType: null,
    errorSignature: { type: 'Error', normalizedMessage: '', category: 'unknown' },
    failureType: null,
    targetUrl: 'http://a.test/',
    normalizedPath: '/',
    httpStatuses: [],
    failedRequestPaths: [],
    consoleErrorSignatures: [],
    pageErrorSignatures: [],
    selectorSignature: null,
    affectedArea: null,
    browserName: 'chromium',
    browserVersion: '150',
    evidenceTypes: [],
    investigationId: null,
    startedAt: '2026-08-23T10:00:00Z',
    status: 'failed',
    ...over,
  };
}

describe('similarityScorer', () => {
  it('strong band when endpoint + category + error all match', () => {
    const a = fp({
      testRunId: 'A',
      failedRequestPaths: ['/api/orders/:id'],
      normalizedPath: '/checkout',
      errorSignature: { type: 'Error', normalizedMessage: 'http 500', category: 'http' },
      consoleErrorSignatures: ['cannot read x'],
      pageErrorSignatures: ['typeerror x'],
      classification: 'application_defect',
      affectedArea: 'checkout',
    });
    const b = fp({
      testRunId: 'B',
      failedRequestPaths: ['/api/orders/:id'],
      normalizedPath: '/checkout',
      errorSignature: { type: 'Error', normalizedMessage: 'http 500', category: 'http' },
      consoleErrorSignatures: ['cannot read x'],
      pageErrorSignatures: ['typeerror x'],
      classification: 'application_defect',
      affectedArea: 'checkout',
    });
    const s = scoreSimilarity(a, b);
    expect(s.score).toBeGreaterThanOrEqual(0.85);
    expect(s.band).toBe('strong');
  });

  it('unlikely band when only category matches', () => {
    const a = fp({
      testRunId: 'A',
      failedRequestPaths: ['/api/x'],
      errorSignature: { type: 'Error', normalizedMessage: 'x', category: 'http' },
    });
    const b = fp({
      testRunId: 'B',
      failedRequestPaths: ['/api/y'],
      errorSignature: { type: 'Error', normalizedMessage: 'y', category: 'http' },
    });
    const s = scoreSimilarity(a, b);
    expect(s.band).toBe('unlikely');
    expect(s.signals.some((sig) => sig.name === 'same_error_category')).toBe(true);
  });

  it('signals carry human-readable explanations', () => {
    const a = fp({ testRunId: 'A', failedRequestPaths: ['/api/x'] });
    const b = fp({ testRunId: 'B', failedRequestPaths: ['/api/x'] });
    const s = scoreSimilarity(a, b);
    expect(s.signals[0]!.explanation).toContain('/api/x');
  });
});

describe('candidate blocker', () => {
  it('creates candidate pairs only for shared blocking keys', () => {
    const a = fp({ testRunId: 'A', failedRequestPaths: ['/api/x'] });
    const b = fp({ testRunId: 'B', failedRequestPaths: ['/api/x'] });
    const c = fp({ testRunId: 'C', failedRequestPaths: ['/api/z'] });
    const pairs = generateCandidatePairs([a, b, c], 100);
    expect(pairs.map((p) => [p.a.testRunId, p.b.testRunId].sort())).toContainEqual(['A', 'B']);
    const acPair = pairs.find(
      (p) =>
        (p.a.testRunId === 'A' && p.b.testRunId === 'C') ||
        (p.a.testRunId === 'C' && p.b.testRunId === 'A'),
    );
    expect(acPair).toBeUndefined();
  });

  it('respects maxPairs cap', () => {
    const items = Array.from({ length: 20 }, (_, i) => fp({ testRunId: `R${i}`, failedRequestPaths: ['/api/x'] }));
    const pairs = generateCandidatePairs(items, 5);
    expect(pairs.length).toBeLessThanOrEqual(5);
  });

  it('blockingKeysFor produces meaningful keys', () => {
    const keys = blockingKeysFor(
      fp({
        failedRequestPaths: ['/api/orders'],
        errorSignature: { type: 'Error', normalizedMessage: 'x', category: 'http' },
        affectedArea: 'checkout',
      }),
    );
    expect(keys).toEqual(expect.arrayContaining(['endpoint:/api/orders', 'category:http', 'area:checkout']));
  });
});

describe('union-find', () => {
  it('groups transitively connected ids', () => {
    const uf = new UnionFind();
    uf.union('A', 'B');
    uf.union('B', 'C');
    uf.add('D');
    const c = uf.components();
    const groups = Array.from(c.values()).map((arr) => arr.sort());
    const abc = groups.find((g) => g.includes('A'));
    expect(abc?.sort()).toEqual(['A', 'B', 'C']);
    const d = groups.find((g) => g.includes('D'));
    expect(d).toEqual(['D']);
  });
});

describe('clusterFingerprints (deterministic path)', () => {
  it('groups strongly similar failures and keeps unrelated apart', async () => {
    const a = fp({ testRunId: 'A', externalTestId: 't-checkout', failedRequestPaths: ['/api/orders/:id'], normalizedPath: '/checkout', errorSignature: { type: 'Error', normalizedMessage: 'http 500', category: 'http' }, consoleErrorSignatures: ['x'], pageErrorSignatures: ['pe'], affectedArea: 'checkout', classification: 'application_defect' });
    const b = fp({ testRunId: 'B', externalTestId: 't-checkout', failedRequestPaths: ['/api/orders/:id'], normalizedPath: '/checkout', errorSignature: { type: 'Error', normalizedMessage: 'http 500', category: 'http' }, consoleErrorSignatures: ['x'], pageErrorSignatures: ['pe'], affectedArea: 'checkout', classification: 'application_defect' });
    const c = fp({ testRunId: 'C', externalTestId: 't-login', failedRequestPaths: ['/api/session'], normalizedPath: '/login', errorSignature: { type: 'TimeoutError', normalizedMessage: 'timeout waiting for locator', category: 'timeout' } });
    const { drafts, summary } = await clusterFingerprints({
      fingerprints: [a, b, c],
      runsById: new Map(),
      passHistoryByExternalTestId: new Map(),
    });
    expect(drafts.length).toBe(2);
    const checkoutCluster = drafts.find((d) => d.occurrenceCount === 2);
    expect(checkoutCluster).toBeDefined();
    expect(checkoutCluster!.primaryFailureSignature).toContain('/api/orders/:id');
    expect(summary.aiComparisons).toBe(0);
  });

  it('is deterministic across repeated runs', async () => {
    const a = fp({ testRunId: 'A', externalTestId: 't1', failedRequestPaths: ['/api/x'], errorSignature: { type: 'Error', normalizedMessage: 'err', category: 'http' }, affectedArea: 'x' });
    const b = fp({ testRunId: 'B', externalTestId: 't1', failedRequestPaths: ['/api/x'], errorSignature: { type: 'Error', normalizedMessage: 'err', category: 'http' }, affectedArea: 'x' });
    const c = fp({ testRunId: 'C', externalTestId: 't1', failedRequestPaths: ['/api/x'], errorSignature: { type: 'Error', normalizedMessage: 'err', category: 'http' }, affectedArea: 'x' });
    const r1 = await clusterFingerprints({ fingerprints: [a, b, c], runsById: new Map(), passHistoryByExternalTestId: new Map() });
    const r2 = await clusterFingerprints({ fingerprints: [a, b, c], runsById: new Map(), passHistoryByExternalTestId: new Map() });
    const keys = (r: typeof r1) => r.drafts.map((d) => d.fingerprintKey).sort();
    expect(keys(r1)).toEqual(keys(r2));
    expect(r1.drafts[0]!.occurrenceCount).toBe(r2.drafts[0]!.occurrenceCount);
  });

  it('regression detection: PASS PASS PASS FAIL → regressed', async () => {
    const failStart = new Date('2026-08-23T10:00:00Z');
    const a = fp({ testRunId: 'A', externalTestId: 't1', startedAt: failStart.toISOString(), failedRequestPaths: ['/api/x'], errorSignature: { type: 'Error', normalizedMessage: 'err', category: 'http' } });
    const history: TestRunRecord[] = ['2026-08-20T10:00:00Z', '2026-08-21T10:00:00Z', '2026-08-22T10:00:00Z'].map((iso, i) => ({
      id: `p${i}`,
      test_case_id: null,
      external_test_id: 't1',
      test_name: 't',
      status: 'passed',
      started_at: new Date(iso),
      finished_at: new Date(iso),
      duration_ms: 10,
      error_name: null,
      error_message: null,
      error_step_index: null,
      owner_id: null,
      created_at: new Date(iso),
    }));
    const map = new Map<string, TestRunRecord[]>([['t1', history]]);
    const { drafts } = await clusterFingerprints({ fingerprints: [a], runsById: new Map(), passHistoryByExternalTestId: map });
    expect(drafts[0]!.regressionStatus).toBe('regressed');
    expect(drafts[0]!.status).toBe('regressed');
  });

  it('resolution detection: recent 3-pass streak → resolved', async () => {
    const failAt = new Date('2026-08-20T10:00:00Z');
    const a = fp({ testRunId: 'A', externalTestId: 't2', startedAt: failAt.toISOString(), failedRequestPaths: ['/api/x'], errorSignature: { type: 'Error', normalizedMessage: 'err', category: 'http' } });
    const later: TestRunRecord[] = ['2026-08-21T10:00:00Z', '2026-08-22T10:00:00Z', '2026-08-23T10:00:00Z'].map((iso, i) => ({
      id: `p${i}`,
      test_case_id: null,
      external_test_id: 't2',
      test_name: 't',
      status: 'passed',
      started_at: new Date(iso),
      finished_at: new Date(iso),
      duration_ms: 10,
      error_name: null,
      error_message: null,
      error_step_index: null,
      owner_id: null,
      created_at: new Date(iso),
    }));
    const map = new Map<string, TestRunRecord[]>([['t2', later]]);
    const { drafts } = await clusterFingerprints({ fingerprints: [a], runsById: new Map(), passHistoryByExternalTestId: map });
    expect(drafts[0]!.regressionStatus).toBe('resolved');
    expect(drafts[0]!.status).toBe('resolved');
  });

  it('AI compare called only for ambiguous pairs and bounded', async () => {
    const a = fp({ testRunId: 'A', failedRequestPaths: ['/api/x'], normalizedPath: '/one', errorSignature: { type: 'Error', normalizedMessage: 'msg-a', category: 'http' } });
    const b = fp({ testRunId: 'B', failedRequestPaths: ['/api/x'], normalizedPath: '/two', errorSignature: { type: 'Error', normalizedMessage: 'msg-b', category: 'http' } });
    let calls = 0;
    const fake = new FakeLLMProvider(() => {
      calls += 1;
      return JSON.stringify({ sameUnderlyingBug: true, confidence: 0.9, explanation: 'same' });
    });
    const cmp = new AiPairComparator(fake, 'fake-model');
    const { drafts, summary } = await clusterFingerprints({
      fingerprints: [a, b],
      runsById: new Map(),
      passHistoryByExternalTestId: new Map(),
      comparator: cmp,
      options: { maxAiComparisons: 10 },
    });
    expect(calls).toBe(1);
    expect(summary.aiComparisons).toBe(1);
    expect(drafts.length).toBe(1); // merged by AI decision
  });

  it('AI says different: pair not merged', async () => {
    const a = fp({ testRunId: 'A', failedRequestPaths: ['/api/x'], normalizedPath: '/one', errorSignature: { type: 'Error', normalizedMessage: 'msg-a', category: 'http' } });
    const b = fp({ testRunId: 'B', failedRequestPaths: ['/api/x'], normalizedPath: '/two', errorSignature: { type: 'Error', normalizedMessage: 'msg-b', category: 'http' } });
    const fake = new FakeLLMProvider(() => JSON.stringify({ sameUnderlyingBug: false, confidence: 0.9, explanation: 'different' }));
    const cmp = new AiPairComparator(fake, 'fake');
    const { drafts } = await clusterFingerprints({ fingerprints: [a, b], runsById: new Map(), passHistoryByExternalTestId: new Map(), comparator: cmp });
    expect(drafts.length).toBe(2);
  });

  it('AI malformed response falls back to deterministic separation', async () => {
    const a = fp({ testRunId: 'A', failedRequestPaths: ['/api/x'], normalizedPath: '/one', errorSignature: { type: 'Error', normalizedMessage: 'a', category: 'http' } });
    const b = fp({ testRunId: 'B', failedRequestPaths: ['/api/x'], normalizedPath: '/two', errorSignature: { type: 'Error', normalizedMessage: 'b', category: 'http' } });
    const cmp = new AiPairComparator(new FakeLLMProvider(() => 'not json'), 'fake');
    const { drafts } = await clusterFingerprints({ fingerprints: [a, b], runsById: new Map(), passHistoryByExternalTestId: new Map(), comparator: cmp });
    expect(drafts.length).toBe(2);
  });

  it('AI provider error does not throw clustering', async () => {
    const a = fp({ testRunId: 'A', failedRequestPaths: ['/api/x'], normalizedPath: '/one', errorSignature: { type: 'Error', normalizedMessage: 'a', category: 'http' } });
    const b = fp({ testRunId: 'B', failedRequestPaths: ['/api/x'], normalizedPath: '/two', errorSignature: { type: 'Error', normalizedMessage: 'b', category: 'http' } });
    const cmp = new AiPairComparator(new FakeLLMProvider(() => new LLMProviderError('boom', 'network')), 'fake');
    await expect(
      clusterFingerprints({ fingerprints: [a, b], runsById: new Map(), passHistoryByExternalTestId: new Map(), comparator: cmp }),
    ).resolves.toBeDefined();
  });

  it('missing investigation: still clusters using deterministic signals', async () => {
    const a = fp({ testRunId: 'A', investigationId: null, classification: 'unknown', affectedArea: null, failedRequestPaths: ['/api/x'], errorSignature: { type: 'Error', normalizedMessage: 'err', category: 'http' } });
    const b = fp({ testRunId: 'B', investigationId: null, classification: 'unknown', affectedArea: null, failedRequestPaths: ['/api/x'], errorSignature: { type: 'Error', normalizedMessage: 'err', category: 'http' } });
    const { drafts } = await clusterFingerprints({ fingerprints: [a, b], runsById: new Map(), passHistoryByExternalTestId: new Map() });
    expect(drafts.length).toBe(1);
    expect(drafts[0]!.occurrenceCount).toBe(2);
  });

  it('synthetic 100-run benchmark stays within limits', async () => {
    const many: FailureFingerprint[] = [];
    for (let i = 0; i < 100; i += 1) {
      const bucket = i % 5;
      many.push(
        fp({
          testRunId: `R${i}`,
          externalTestId: `t${bucket}`,
          startedAt: new Date(2026, 7, 1 + (i % 20)).toISOString(),
          failedRequestPaths: [`/api/bucket-${bucket}`],
          normalizedPath: `/page-${bucket}`,
          errorSignature: { type: 'Error', normalizedMessage: `msg-${bucket}`, category: 'http' },
        }),
      );
    }
    const { drafts, summary } = await clusterFingerprints({
      fingerprints: many,
      runsById: new Map(),
      passHistoryByExternalTestId: new Map(),
      options: { maxCandidatePairs: 2000, maxAiComparisons: 0 },
    });
    expect(drafts.length).toBe(5); // one per bucket
    expect(summary.candidatePairs).toBeLessThanOrEqual(2000);
    expect(summary.aiComparisons).toBe(0);
    expect(drafts.every((d) => d.occurrenceCount === 20)).toBe(true);
  });
});
