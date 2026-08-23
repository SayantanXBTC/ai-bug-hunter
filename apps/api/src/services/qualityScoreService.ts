import type { Pool } from 'pg';
import { env } from '../config/env.js';
import type {
  QualityScoreBreakdown,
  QualityScoreResult,
} from '@ai-bug-hunter/shared';

// Weight constants — exported so tests and docs can reference them.
export const PASS_RATE_WEIGHT = 40;
export const CRITICAL_FAILURE_WEIGHT = 20;
export const REGRESSION_WEIGHT = 15;
export const FLAKY_WEIGHT = 10;
export const OPEN_BUG_SEVERITY_WEIGHT = 10;
export const CAMPAIGN_HEALTH_WEIGHT = 5;

export const MIN_RUNS_FOR_CONFIDENCE = 10;

const QUALITY_SCORE_MAX_RUNS_DEFAULT = 500;

export function getMaxRuns(): number {
  const raw = process.env.QUALITY_SCORE_MAX_RUNS;
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return QUALITY_SCORE_MAX_RUNS_DEFAULT;
}

export interface QualityScoreRun {
  status: 'passed' | 'failed' | 'error';
  errorName: string | null;
  errorMessage: string | null;
}

export interface QualityScoreCluster {
  status: string;
  regressionStatus: string;
  severity: string;
}

export interface QualityScoreReliability {
  status: string;
}

export interface QualityScoreCampaign {
  quality: string | null;
}

export interface QualityScoreInputs {
  runs: QualityScoreRun[];
  clusters: QualityScoreCluster[];
  reliability: QualityScoreReliability[];
  recentCampaign: QualityScoreCampaign | null;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  unknown: 1,
};

function classifyCritical(run: QualityScoreRun): boolean {
  if (run.status === 'passed') return false;
  const combined = `${run.errorName ?? ''} ${run.errorMessage ?? ''}`.toLowerCase();
  return (
    combined.includes('critical') ||
    combined.includes('fatal') ||
    combined.includes('crash') ||
    run.status === 'error'
  );
}

/**
 * Deterministic quality score.
 *
 * Formula:
 *   score = (PASS_RATE_WEIGHT × pass_rate) + campaign_bonus − penalties
 *   where:
 *     campaign_bonus = CAMPAIGN_HEALTH_WEIGHT if recent campaign is 'healthy', else 0
 *     penalties = critical_failure_penalty + regression_penalty
 *                 + flaky_penalty + open_bug_severity_penalty
 *   All penalties are proportional to their respective metric and capped by their weight.
 *
 * Also grants a proportional baseline (up to 100 - PASS_RATE_WEIGHT) whenever there is
 * any pass activity so a 100% pass rate can yield a score of 100. Concretely:
 *   base = PASS_RATE_WEIGHT × pass_rate + (100 - PASS_RATE_WEIGHT) × pass_rate
 *        = 100 × pass_rate
 * with penalties then subtracted.
 *
 * Score is clamped to [0, 100].
 */
export function computeQualityScoreFromInputs(
  inputs: QualityScoreInputs,
): QualityScoreResult {
  const total = inputs.runs.length;
  const passed = inputs.runs.filter((r) => r.status === 'passed').length;
  const passRate = total === 0 ? 0 : passed / total;

  const criticalFailures = inputs.runs.filter(classifyCritical).length;
  const criticalRate = total === 0 ? 0 : criticalFailures / total;

  const regressed = inputs.clusters.filter(
    (c) => c.regressionStatus === 'regressed' && c.status !== 'resolved',
  ).length;
  // Scale: 1 regression = 5, cap at REGRESSION_WEIGHT.
  const regressionPenalty = Math.min(REGRESSION_WEIGHT, regressed * 5);

  const flakyCount = inputs.reliability.filter(
    (r) => r.status === 'flaky' || r.status === 'suspected_flaky',
  ).length;
  const totalReliability = inputs.reliability.length;
  const flakyRatio = totalReliability === 0 ? 0 : flakyCount / totalReliability;
  const flakyPenalty = FLAKY_WEIGHT * flakyRatio;

  const openBugs = inputs.clusters.filter(
    (c) => c.status !== 'resolved',
  );
  const severitySum = openBugs.reduce(
    (acc, c) => acc + (SEVERITY_WEIGHT[c.severity] ?? SEVERITY_WEIGHT.unknown!),
    0,
  );
  // Normalize: 20 severity points = full penalty.
  const bugSeverityPenalty = Math.min(OPEN_BUG_SEVERITY_WEIGHT, (severitySum / 20) * OPEN_BUG_SEVERITY_WEIGHT);

  const campaignBonus =
    inputs.recentCampaign?.quality === 'healthy' ? CAMPAIGN_HEALTH_WEIGHT : 0;

  const criticalPenalty = CRITICAL_FAILURE_WEIGHT * criticalRate;

  const baseScore = 100 * passRate;
  const rawScore =
    baseScore + campaignBonus - criticalPenalty - regressionPenalty - flakyPenalty - bugSeverityPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const breakdown: QualityScoreBreakdown = {
    passRate: {
      raw: passRate,
      weightedContribution: Math.round(PASS_RATE_WEIGHT * passRate * 100) / 100,
      explanation: `${passed}/${total} runs passed (${(passRate * 100).toFixed(1)}%).`,
    },
    criticalFailures: {
      raw: criticalRate,
      weightedContribution: -Math.round(criticalPenalty * 100) / 100,
      explanation: `${criticalFailures} critical/error failures out of ${total} runs.`,
    },
    regressions: {
      raw: regressed,
      weightedContribution: -regressionPenalty,
      explanation: `${regressed} open regressed cluster(s).`,
    },
    flaky: {
      raw: flakyRatio,
      weightedContribution: -Math.round(flakyPenalty * 100) / 100,
      explanation: `${flakyCount}/${totalReliability} tests flagged flaky.`,
    },
    openBugSeverity: {
      raw: severitySum,
      weightedContribution: -Math.round(bugSeverityPenalty * 100) / 100,
      explanation: `Severity-weighted open bugs total ${severitySum}.`,
    },
    campaignHealth: {
      raw: inputs.recentCampaign?.quality === 'healthy' ? 1 : 0,
      weightedContribution: campaignBonus,
      explanation: inputs.recentCampaign
        ? `Most recent campaign quality: ${inputs.recentCampaign.quality ?? 'unknown'}.`
        : 'No recent regression campaign.',
    },
  };

  const result: QualityScoreResult = {
    score,
    breakdown,
    computedAt: new Date().toISOString(),
    sampleSize: total,
  };
  if (total < MIN_RUNS_FOR_CONFIDENCE) {
    result.warning = `Only ${total} run(s) analyzed; score has low confidence (need ${MIN_RUNS_FOR_CONFIDENCE}+).`;
  }
  return result;
}

export interface LoadInputsOptions {
  applicationId?: string;
  maxRuns?: number;
  /** Tenant scope: when isAdmin=false, only rows owned by userId contribute. */
  userId?: string;
  isAdmin?: boolean;
}

/**
 * Load inputs from the database. Kept separate from `computeQualityScoreFromInputs`
 * so the pure computation can be tested without a live DB.
 */
export async function loadInputsForApp(
  pool: Pool,
  opts: LoadInputsOptions = {},
): Promise<QualityScoreInputs> {
  const maxRuns = opts.maxRuns ?? getMaxRuns();
  const scoped = opts.userId && opts.isAdmin === false;

  // Runs: last N — filtered by owner when tenant scope is active.
  const runsFilters: string[] = [];
  const runsParams: unknown[] = [];
  if (opts.applicationId) {
    runsParams.push(opts.applicationId);
    runsFilters.push(`(tc.application_id = $${runsParams.length} OR tr.test_case_id IS NULL)`);
  }
  if (scoped) {
    runsParams.push(opts.userId!);
    runsFilters.push(`tr.owner_id = $${runsParams.length}`);
  }
  const runsWhere = runsFilters.length > 0 ? `WHERE ${runsFilters.join(' AND ')}` : '';
  runsParams.push(maxRuns);
  const runsSql = `SELECT tr.status, tr.error_name, tr.error_message
                   FROM test_runs tr
                   LEFT JOIN test_cases tc ON tc.id = tr.test_case_id
                   ${runsWhere}
                   ORDER BY tr.created_at DESC LIMIT $${runsParams.length}`;
  const runsRes = await pool.query<{ status: 'passed' | 'failed' | 'error'; error_name: string | null; error_message: string | null }>(
    runsSql,
    runsParams,
  );
  const runs: QualityScoreRun[] = runsRes.rows.map((r) => ({
    status: r.status,
    errorName: r.error_name,
    errorMessage: r.error_message,
  }));

  const clustersParams: unknown[] = [];
  let clustersWhere = '';
  if (scoped) {
    clustersParams.push(opts.userId!);
    clustersWhere = `WHERE owner_id = $${clustersParams.length}`;
  }
  const clustersRes = await pool.query<{ status: string; regression_status: string; severity: string }>(
    `SELECT status, regression_status, severity FROM bug_clusters ${clustersWhere} LIMIT 1000`,
    clustersParams,
  );
  const clusters: QualityScoreCluster[] = clustersRes.rows.map((c) => ({
    status: c.status,
    regressionStatus: c.regression_status,
    severity: c.severity,
  }));

  // Reliability rows have no owner_id — for non-admins, intersect via test_runs.
  let reliability: QualityScoreReliability[];
  if (scoped) {
    const reliabilityRes = await pool.query<{ status: string }>(
      `SELECT s.status FROM test_reliability_snapshots s
       WHERE EXISTS (
         SELECT 1 FROM test_runs r
         WHERE r.external_test_id = s.external_test_id
           AND r.owner_id = $1
       )
       LIMIT 1000`,
      [opts.userId!],
    );
    reliability = reliabilityRes.rows.map((r) => ({ status: r.status }));
  } else {
    const reliabilityRes = await pool.query<{ status: string }>(
      `SELECT status FROM test_reliability_snapshots LIMIT 1000`,
    );
    reliability = reliabilityRes.rows.map((r) => ({ status: r.status }));
  }

  const campaignFilters: string[] = [];
  const campaignParams: unknown[] = [];
  if (opts.applicationId) {
    campaignParams.push(opts.applicationId);
    campaignFilters.push(`application_id = $${campaignParams.length}`);
  }
  if (scoped) {
    campaignParams.push(opts.userId!);
    campaignFilters.push(`owner_id = $${campaignParams.length}`);
  }
  const campaignWhere = campaignFilters.length > 0 ? `WHERE ${campaignFilters.join(' AND ')}` : '';
  const campaignSql = `SELECT quality FROM regression_campaigns ${campaignWhere} ORDER BY created_at DESC LIMIT 1`;
  const campaignRes = await pool.query<{ quality: string | null }>(campaignSql, campaignParams);
  const recentCampaign = campaignRes.rows[0] ? { quality: campaignRes.rows[0].quality } : null;

  return { runs, clusters, reliability, recentCampaign };
}

export async function computeQualityScore(
  pool: Pool,
  opts: LoadInputsOptions = {},
): Promise<QualityScoreResult> {
  const inputs = await loadInputsForApp(pool, opts);
  return computeQualityScoreFromInputs(inputs);
}

// Ensure env import is not tree-shaken away in case tests reference it later.
void env;
