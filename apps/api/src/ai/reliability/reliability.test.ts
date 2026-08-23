import { describe, it, expect } from 'vitest';
import { calculateReliability } from './flakyScorer.js';
import type { TestRunRecord } from '../../db/repositories/testRunRepo.js';

function run(
  id: string,
  status: 'passed' | 'failed' | 'error',
  startedAt: Date,
  durationMs = 100,
  errorMessage: string | null = null,
): TestRunRecord {
  return {
    id,
    test_case_id: null,
    external_test_id: 't1',
    test_name: 'Test',
    status,
    started_at: startedAt,
    finished_at: startedAt,
    duration_ms: durationMs,
    error_name: errorMessage ? 'Error' : null,
    error_message: errorMessage,
    error_step_index: null,
    owner_id: null,
    created_at: startedAt,
  };
}

function timeline(pattern: string, durations?: number[]): TestRunRecord[] {
  const start = new Date('2026-08-01T00:00:00Z').getTime();
  return pattern.split('').map((ch, i) => {
    const status: 'passed' | 'failed' | 'error' =
      ch === 'P' ? 'passed' : ch === 'F' ? 'failed' : 'error';
    return run(`r${i}`, status, new Date(start + i * 60_000), durations?.[i] ?? 100);
  });
}

describe('reliability — classification', () => {
  it('insufficient_data below MIN_FLAKY_RUNS', () => {
    const r = calculateReliability({
      runs: timeline('PPPFF'),
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    expect(r.status).toBe('insufficient_data');
  });

  it('stable when all pass', () => {
    const r = calculateReliability({
      runs: timeline('PPPPPPPPPP'),
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    expect(r.status).toBe('stable');
    expect(r.flakyScore).toBe(0);
    expect(r.reliabilityScore).toBe(1);
  });

  it('flaky when outcomes alternate with distinct signatures', () => {
    const runs = timeline('PFPFPFPFPF');
    // Inject varying error messages so signatures differ.
    runs.filter((r) => r.status !== 'passed').forEach((r, i) => {
      r.error_message = i % 2 === 0 ? 'timeout waiting for locator' : 'net::ERR_ABORTED';
    });
    const r = calculateReliability({
      runs,
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    expect(r.status).toBe('flaky');
    expect(r.flakyScore).toBeGreaterThan(0.3);
    expect(r.signals.some((s) => s.name === 'alternation_rate')).toBe(true);
    expect(r.signals.some((s) => s.name === 'multiple_failure_signatures')).toBe(false);
    // Two distinct sigs, so >=3 threshold not hit; that's fine — status still flaky via other criteria.
  });

  it('stable_broken (unstable) not falsely flaky when same signature repeats', () => {
    const runs = timeline('FFFFFFFFFF');
    runs.forEach((r) => (r.error_message = 'HTTP 500 on /api/orders'));
    const r = calculateReliability({
      runs,
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    expect(r.status).toBe('unstable');
    expect(r.signals.some((s) => s.name === 'single_bug_cluster_domination')).toBe(true);
  });

  it('regression pattern (PPPPPPPPFF) is not classified flaky', () => {
    const r = calculateReliability({
      runs: timeline('PPPPPPPPFF'),
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    expect(['unstable', 'stable']).toContain(r.status);
    expect(r.status).not.toBe('flaky');
  });

  it('recovery pattern (FFFFFPPPPP) yields low current failure trend', () => {
    const r = calculateReliability({
      runs: timeline('FFFFFPPPPP'),
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    expect(r.consecutivePasses).toBe(5);
  });

  it('duration variability signal', () => {
    const durations = [50, 500, 40, 800, 60, 900, 30, 700, 80, 950];
    const r = calculateReliability({
      runs: timeline('PPPPPPPPPP', durations),
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    // All pass so status is stable, but duration stats should reflect variance.
    expect(r.durationStats.stddev).toBeGreaterThan(100);
  });

  it('environment correlation detected across browsers', () => {
    const runs = timeline('PPPPPPPPPP');
    // Chromium 100 all fail, chromium 200 all pass.
    runs.forEach((r, i) => {
      r.status = i < 5 ? 'failed' : 'passed';
      r.error_message = i < 5 ? 'boom' : null;
    });
    const envMap = new Map<string, { browserName: string | null; browserVersion: string | null }>();
    runs.forEach((r, i) =>
      envMap.set(r.id, {
        browserName: 'chromium',
        browserVersion: i < 5 ? '100' : '200',
      }),
    );
    const rel = calculateReliability({
      runs,
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      environmentByRunId: envMap,
      minRuns: 10,
    });
    expect(rel.environmentSignals.correlationDetected).toBe(true);
  });

  it('BugCluster association keeps test out of flaky when all failures point to same cluster', () => {
    const runs = timeline('PFPFPFPFPF');
    const fpMap = new Map<string, { signature: string; bugClusterId: string | null }>();
    runs
      .filter((r) => r.status !== 'passed')
      .forEach((r) => fpMap.set(r.id, { signature: 'checkout-500', bugClusterId: 'C1' }));
    const rel = calculateReliability({
      runs,
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      fingerprintByRunId: fpMap,
      minRuns: 10,
    });
    expect(rel.status).toBe('unstable'); // single-cluster domination trumps alternation
    expect(rel.signals.some((s) => s.name === 'single_bug_cluster_domination')).toBe(true);
  });

  it('reliability metrics are deterministic (same input → same output)', () => {
    const a = calculateReliability({
      runs: timeline('PFPFPPPFPF'),
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    const b = calculateReliability({
      runs: timeline('PFPFPPPFPF'),
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    expect(a.flakyScore).toBe(b.flakyScore);
    expect(a.status).toBe(b.status);
    expect(a.durationStats).toEqual(b.durationStats);
  });

  it('explanation generated', () => {
    const r = calculateReliability({
      runs: timeline('PPPPPPPPPP'),
      externalTestId: 't',
      testName: 'T',
      testCaseId: null,
      minRuns: 10,
    });
    expect(r.explanation).toContain('passed');
  });
});
