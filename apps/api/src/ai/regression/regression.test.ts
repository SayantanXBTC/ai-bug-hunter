import { describe, it, expect } from 'vitest';
import { scoreTestRisk } from './riskScorer.js';
import { selectTests } from './testSelector.js';
import type { TestCaseRow } from '../../db/repositories/testCaseRepo.js';
import type { BugClusterRow } from '../../db/repositories/bugClusterRepo.js';
import type { ReliabilityRow } from '../../db/repositories/testReliabilityRepo.js';

function tc(id: string, over: Partial<TestCaseRow> = {}): TestCaseRow {
  return {
    id,
    application_id: null,
    name: `Test ${id}`,
    description: null,
    target_url: 'http://x/',
    definition: { id: `ext-${id}`, name: `Test ${id}`, targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
    priority: 'medium',
    enabled: true,
    tags: [],
    source: 'manual',
    external_test_id: `ext-${id}`,
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  };
}

function rel(over: Partial<ReliabilityRow>): ReliabilityRow {
  return {
    id: 'rel-x',
    test_case_id: null,
    external_test_id: 't',
    total_runs: 20,
    pass_count: 18,
    failure_count: 2,
    error_count: 0,
    flaky_score: '0.10',
    reliability_score: '0.90',
    status: 'stable',
    signals: [],
    duration_stats: {},
    environment_signals: {},
    first_run_at: null,
    last_run_at: new Date(),
    calculated_at: new Date(),
    ...over,
  };
}

function cluster(over: Partial<BugClusterRow>): BugClusterRow {
  return {
    id: 'c-x',
    fingerprint_key: 'abc',
    title: 'x',
    description: null,
    status: 'open',
    severity: 'medium',
    confidence: '0.5',
    first_seen_at: new Date(),
    last_seen_at: new Date(),
    occurrence_count: 1,
    affected_test_count: 1,
    affected_page_count: 1,
    affected_endpoint_count: 1,
    regression_status: 'recurring',
    primary_run_id: null,
    primary_investigation_id: null,
    primary_failure_signature: null,
    root_cause_summary: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  };
}

describe('scoreTestRisk', () => {
  it('adds priority weight', () => {
    const r = scoreTestRisk(tc('a', { priority: 'critical' }), {
      reliability: null,
      associatedBugClusters: [],
      lastRunAt: null,
      now: new Date(),
    });
    expect(r.signals.some((s) => s.name === 'priority')).toBe(true);
    expect(r.score).toBeGreaterThan(0.15);
  });

  it('boosts risk for regressed cluster association', () => {
    const r = scoreTestRisk(tc('a'), {
      reliability: null,
      associatedBugClusters: [cluster({ regression_status: 'regressed' })],
      lastRunAt: new Date(),
      now: new Date(),
    });
    expect(r.signals.some((s) => s.name === 'regression_risk')).toBe(true);
    expect(r.score).toBeGreaterThan(0.3);
  });

  it('penalises flaky', () => {
    const r = scoreTestRisk(tc('a', { priority: 'medium' }), {
      reliability: rel({ status: 'flaky' }),
      associatedBugClusters: [],
      lastRunAt: new Date(),
      now: new Date(),
    });
    expect(r.signals.some((s) => s.name === 'flaky_penalty')).toBe(true);
  });

  it('is deterministic', () => {
    const now = new Date();
    const t = tc('a', { priority: 'high' });
    const a = scoreTestRisk(t, { reliability: rel({ status: 'stable' }), associatedBugClusters: [], lastRunAt: null, now });
    const b = scoreTestRisk(t, { reliability: rel({ status: 'stable' }), associatedBugClusters: [], lastRunAt: null, now });
    expect(a.score).toBe(b.score);
  });
});

describe('selectTests', () => {
  const cases = [
    tc('1', { priority: 'critical', tags: ['smoke'] }),
    tc('2', { priority: 'high' }),
    tc('3', { priority: 'medium' }),
    tc('4', { priority: 'low', enabled: false }),
    tc('5', { priority: 'low', tags: ['authentication'] }),
  ];
  const risks = new Map(
    cases.map((c) => [
      c.id,
      scoreTestRisk(c, { reliability: null, associatedBugClusters: [], lastRunAt: null, now: new Date() }),
    ]),
  );

  it('all_enabled skips disabled', () => {
    const s = selectTests({ testCases: cases, riskByTestCaseId: risks, strategy: 'all_enabled' });
    expect(s.find((x) => x.testCaseId === '4')).toBeUndefined();
    expect(s).toHaveLength(4);
  });

  it('smoke prefers critical + smoke-tagged + authentication', () => {
    const s = selectTests({ testCases: cases, riskByTestCaseId: risks, strategy: 'smoke' });
    const ids = s.map((x) => x.testCaseId).sort();
    expect(ids).toEqual(['1', '5'].sort());
  });

  it('risk_based orders by score desc', () => {
    // Boost test 2 with regression risk.
    const localRisks = new Map(risks);
    localRisks.set(
      '2',
      scoreTestRisk(cases[1]!, {
        reliability: null,
        associatedBugClusters: [cluster({ regression_status: 'regressed' })],
        lastRunAt: null,
        now: new Date(),
      }),
    );
    const s = selectTests({ testCases: cases, riskByTestCaseId: localRisks, strategy: 'risk_based' });
    expect(s[0]!.testCaseId).toBe('2');
  });

  it('maxTests cap applied', () => {
    const s = selectTests({ testCases: cases, riskByTestCaseId: risks, strategy: 'all_enabled', maxTests: 2 });
    expect(s).toHaveLength(2);
  });

  it('is deterministic across identical inputs', () => {
    const a = selectTests({ testCases: cases, riskByTestCaseId: risks, strategy: 'risk_based' });
    const b = selectTests({ testCases: cases, riskByTestCaseId: risks, strategy: 'risk_based' });
    expect(a.map((x) => x.testCaseId)).toEqual(b.map((x) => x.testCaseId));
  });
});
