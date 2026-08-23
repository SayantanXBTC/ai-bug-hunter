import type { TestRunRecord } from '../../db/repositories/testRunRepo.js';
import type {
  DurationStats,
  EnvironmentBreakdown,
  FailureSignatureCount,
  FlakySignal,
  ReliabilityStatus,
  TestReliability,
} from './reliabilityTypes.js';

export interface ScorerContext {
  runs: TestRunRecord[]; // sorted ASC by started_at
  externalTestId: string;
  testName: string;
  testCaseId: string | null;
  fingerprintByRunId?: Map<string, { signature: string; bugClusterId: string | null }>;
  environmentByRunId?: Map<string, { browserName: string | null; browserVersion: string | null }>;
  minRuns: number;
}

export function calculateReliability(ctx: ScorerContext): TestReliability {
  const runs = ctx.runs;
  const total = runs.length;
  const passCount = runs.filter((r) => r.status === 'passed').length;
  const failureCount = runs.filter((r) => r.status === 'failed').length;
  const errorCount = runs.filter((r) => r.status === 'error').length;
  const failed = failureCount + errorCount;
  const passRate = total === 0 ? 0 : passCount / total;
  const failureRate = total === 0 ? 0 : failed / total;

  const durationStats = computeDurationStats(runs.map((r) => r.duration_ms));

  const consecutive = computeConsecutive(runs);
  const alternationRate = computeAlternationRate(runs);
  const failureSignatures = computeSignatures(runs, ctx.fingerprintByRunId);
  const distinctSignatureCount = failureSignatures.length;
  const dominantSignatureCount = failureSignatures[0]?.count ?? 0;
  const singleClusterDomination =
    failed > 0 && distinctSignatureCount === 1 && dominantSignatureCount === failed;

  const environmentSignals = computeEnvironmentSignals(runs, ctx.environmentByRunId);

  const signals: FlakySignal[] = [];
  let flakyScore = 0;

  if (alternationRate > 0) {
    const contribution = Math.min(0.4, alternationRate * 0.5);
    signals.push({
      name: 'alternation_rate',
      contribution,
      explanation: `Outcomes alternate ${(alternationRate * 100).toFixed(0)}% of adjacent runs (higher = flakier)`,
    });
    flakyScore += contribution;
  }
  if (distinctSignatureCount >= 3) {
    const contribution = 0.2;
    signals.push({
      name: 'multiple_failure_signatures',
      contribution,
      explanation: `${distinctSignatureCount} distinct failure signatures observed (mixed root causes)`,
    });
    flakyScore += contribution;
  }
  if (durationStats.count >= 3 && coefficientOfVariation(durationStats) > 0.5) {
    const contribution = 0.15;
    signals.push({
      name: 'duration_variability',
      contribution,
      explanation: `Duration coefficient of variation ${coefficientOfVariation(durationStats).toFixed(2)} (>0.5 is high)`,
    });
    flakyScore += contribution;
  }
  if (environmentSignals.correlationDetected) {
    const contribution = 0.1;
    signals.push({
      name: 'environment_correlation',
      contribution,
      explanation: `Failure rate differs meaningfully across browsers/versions`,
    });
    flakyScore += contribution;
  }
  if (singleClusterDomination) {
    const contribution = -0.3;
    signals.push({
      name: 'single_bug_cluster_domination',
      contribution,
      explanation: `All failures share one signature — likely a stable defect, not flakiness`,
    });
    flakyScore += contribution;
  }
  if (failed === 0) {
    signals.push({ name: 'no_failures', contribution: 0, explanation: 'No failures in window' });
  }

  flakyScore = clamp(flakyScore, 0, 1);
  const status = classify({
    totalRuns: total,
    minRuns: ctx.minRuns,
    failureCount: failed,
    alternationRate,
    distinctSignatureCount,
    failureRate,
    singleClusterDomination,
  });

  const reliabilityScore = clamp(1 - failureRate * 0.6 - flakyScore * 0.4, 0, 1);

  const first = runs[0];
  const last = runs[runs.length - 1];

  return {
    testCaseId: ctx.testCaseId,
    externalTestId: ctx.externalTestId,
    testName: ctx.testName,
    totalRuns: total,
    passCount,
    failureCount,
    errorCount,
    passRate,
    failureRate,
    flakyScore,
    reliabilityScore,
    status,
    firstRunAt: first ? first.started_at.toISOString() : null,
    lastRunAt: last ? last.started_at.toISOString() : null,
    consecutivePasses: consecutive.trailingPasses,
    consecutiveFailures: consecutive.trailingFailures,
    failureSignatures,
    durationStats,
    environmentSignals,
    signals,
    explanation: buildExplanation({
      status,
      total,
      failed,
      alternationRate,
      distinctSignatureCount,
      singleClusterDomination,
      failureRate,
      minRuns: ctx.minRuns,
    }),
    calculatedAt: new Date().toISOString(),
  };
}

interface ClassifyInput {
  totalRuns: number;
  minRuns: number;
  failureCount: number;
  alternationRate: number;
  distinctSignatureCount: number;
  failureRate: number;
  singleClusterDomination: boolean;
}

function classify(input: ClassifyInput): ReliabilityStatus {
  if (input.totalRuns < input.minRuns) return 'insufficient_data';
  if (input.failureCount === 0) return 'stable';
  if (input.singleClusterDomination) return 'unstable';
  if (input.alternationRate >= 0.4 && input.failureCount >= 3 && input.distinctSignatureCount >= 2) {
    return 'flaky';
  }
  if (input.alternationRate >= 0.2 && input.distinctSignatureCount >= 2) return 'suspected_flaky';
  if (input.failureRate >= 0.3 && input.alternationRate < 0.2) return 'unstable';
  return 'stable';
}

function buildExplanation(i: {
  status: ReliabilityStatus;
  total: number;
  failed: number;
  alternationRate: number;
  distinctSignatureCount: number;
  singleClusterDomination: boolean;
  failureRate: number;
  minRuns: number;
}): string {
  if (i.status === 'insufficient_data') {
    return `Only ${i.total} run(s) recorded (minimum ${i.minRuns} required for reliability classification).`;
  }
  if (i.status === 'stable' && i.failed === 0) {
    return `All ${i.total} runs passed.`;
  }
  if (i.status === 'unstable' && i.singleClusterDomination) {
    return `${i.failed} of ${i.total} runs failed with a single repeating failure signature — likely a stable application defect rather than flakiness.`;
  }
  if (i.status === 'unstable') {
    return `${(i.failureRate * 100).toFixed(0)}% failure rate with low alternation — treated as unstable rather than flaky.`;
  }
  if (i.status === 'flaky') {
    return `Test has ${i.failed} failures in ${i.total} runs. Outcomes alternate frequently and failures originate from ${i.distinctSignatureCount} distinct signatures — indicates test/environment instability.`;
  }
  if (i.status === 'suspected_flaky') {
    return `Some alternation (${(i.alternationRate * 100).toFixed(0)}%) and ${i.distinctSignatureCount} distinct signatures observed, but signal is not yet strong.`;
  }
  return `${i.failed} of ${i.total} runs failed; no strong flakiness signal.`;
}

function computeDurationStats(durations: number[]): DurationStats {
  if (durations.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p95: 0, stddev: 0, count: 0 };
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const median = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const variance = sorted.reduce((s, v) => s + (v - mean) * (v - mean), 0) / sorted.length;
  const stddev = Math.sqrt(variance);
  return { min, max, mean, median, p95, stddev, count: sorted.length };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = (sortedAsc.length - 1) * p;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedAsc[low]!;
  return sortedAsc[low]! + (sortedAsc[high]! - sortedAsc[low]!) * (rank - low);
}

function coefficientOfVariation(s: DurationStats): number {
  if (s.mean === 0) return 0;
  return s.stddev / s.mean;
}

function computeConsecutive(runs: TestRunRecord[]): {
  trailingPasses: number;
  trailingFailures: number;
} {
  let trailingPasses = 0;
  let trailingFailures = 0;
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    if (runs[i]!.status === 'passed') trailingPasses += 1;
    else break;
  }
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    if (runs[i]!.status !== 'passed') trailingFailures += 1;
    else break;
  }
  return { trailingPasses, trailingFailures };
}

function computeAlternationRate(runs: TestRunRecord[]): number {
  if (runs.length < 2) return 0;
  let flips = 0;
  for (let i = 1; i < runs.length; i += 1) {
    const prev = runs[i - 1]!.status === 'passed';
    const cur = runs[i]!.status === 'passed';
    if (prev !== cur) flips += 1;
  }
  return flips / (runs.length - 1);
}

function computeSignatures(
  runs: TestRunRecord[],
  fingerprintByRunId?: Map<string, { signature: string; bugClusterId: string | null }>,
): FailureSignatureCount[] {
  const counts = new Map<string, { count: number; bugClusterId: string | null }>();
  for (const r of runs) {
    if (r.status === 'passed') continue;
    const fp = fingerprintByRunId?.get(r.id);
    const sig = fp?.signature ?? (r.error_message ? r.error_message.slice(0, 120) : r.error_name ?? 'unknown');
    const entry = counts.get(sig) ?? { count: 0, bugClusterId: fp?.bugClusterId ?? null };
    entry.count += 1;
    if (fp?.bugClusterId) entry.bugClusterId = fp.bugClusterId;
    counts.set(sig, entry);
  }
  return Array.from(counts.entries())
    .map(([signature, { count, bugClusterId }]) => ({ signature, count, bugClusterId }))
    .sort((a, b) => b.count - a.count);
}

function computeEnvironmentSignals(
  runs: TestRunRecord[],
  envMap?: Map<string, { browserName: string | null; browserVersion: string | null }>,
): EnvironmentBreakdown {
  const browsers: Record<string, { runs: number; failures: number }> = {};
  for (const r of runs) {
    const env = envMap?.get(r.id);
    const key = env
      ? `${env.browserName ?? 'unknown'}/${env.browserVersion ?? '?'}`
      : 'unknown';
    const bucket = browsers[key] ?? { runs: 0, failures: 0 };
    bucket.runs += 1;
    if (r.status !== 'passed') bucket.failures += 1;
    browsers[key] = bucket;
  }
  const keys = Object.keys(browsers);
  let correlationDetected = false;
  if (keys.length >= 2) {
    const rates = keys.map((k) => browsers[k]!.failures / Math.max(1, browsers[k]!.runs));
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    if (max - min >= 0.3) correlationDetected = true;
  }
  return { browsers, correlationDetected };
}

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
