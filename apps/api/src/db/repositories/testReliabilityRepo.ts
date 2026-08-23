import type { Pool, PoolClient } from 'pg';
import type { TestReliability } from '../../ai/reliability/reliabilityTypes.js';

export interface ReliabilityRow {
  id: string;
  test_case_id: string | null;
  external_test_id: string;
  total_runs: number;
  pass_count: number;
  failure_count: number;
  error_count: number;
  flaky_score: string;
  reliability_score: string;
  status: string;
  signals: unknown;
  duration_stats: unknown;
  environment_signals: unknown;
  first_run_at: Date | null;
  last_run_at: Date | null;
  calculated_at: Date;
}

type Executor = Pool | PoolClient;

export async function upsertReliability(
  exec: Executor,
  r: TestReliability,
): Promise<ReliabilityRow> {
  const { rows } = await exec.query<ReliabilityRow>(
    `INSERT INTO test_reliability_snapshots
      (test_case_id, external_test_id, total_runs, pass_count, failure_count, error_count,
       flaky_score, reliability_score, status, signals, duration_stats, environment_signals,
       first_run_at, last_run_at, calculated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
     ON CONFLICT (external_test_id) DO UPDATE SET
       test_case_id = EXCLUDED.test_case_id,
       total_runs = EXCLUDED.total_runs,
       pass_count = EXCLUDED.pass_count,
       failure_count = EXCLUDED.failure_count,
       error_count = EXCLUDED.error_count,
       flaky_score = EXCLUDED.flaky_score,
       reliability_score = EXCLUDED.reliability_score,
       status = EXCLUDED.status,
       signals = EXCLUDED.signals,
       duration_stats = EXCLUDED.duration_stats,
       environment_signals = EXCLUDED.environment_signals,
       first_run_at = EXCLUDED.first_run_at,
       last_run_at = EXCLUDED.last_run_at,
       calculated_at = NOW()
     RETURNING *`,
    [
      r.testCaseId,
      r.externalTestId,
      r.totalRuns,
      r.passCount,
      r.failureCount,
      r.errorCount,
      r.flakyScore,
      r.reliabilityScore,
      r.status,
      JSON.stringify({ signals: r.signals, explanation: r.explanation, failureSignatures: r.failureSignatures }),
      JSON.stringify(r.durationStats),
      JSON.stringify(r.environmentSignals),
      r.firstRunAt ? new Date(r.firstRunAt) : null,
      r.lastRunAt ? new Date(r.lastRunAt) : null,
    ],
  );
  return rows[0]!;
}

export async function listReliability(
  exec: Executor,
  opts: { page: number; limit: number; status?: string; flakyOnly?: boolean; minRuns?: number },
): Promise<{ items: ReliabilityRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const filters: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    params.push(opts.status);
    filters.push(`status = $${params.length}`);
  }
  if (opts.flakyOnly) {
    filters.push(`status IN ('flaky','suspected_flaky')`);
  }
  if (opts.minRuns !== undefined) {
    params.push(opts.minRuns);
    filters.push(`total_runs >= $${params.length}`);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  params.push(opts.limit, offset);
  const items = await exec.query<ReliabilityRow>(
    `SELECT * FROM test_reliability_snapshots ${where}
     ORDER BY flaky_score DESC, calculated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const countRes = await exec.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM test_reliability_snapshots ${where}`,
    params.slice(0, filters.length - (opts.minRuns !== undefined ? 0 : 0)),
  );
  return { items: items.rows, total: Number(countRes.rows[0]!.count) };
}

export async function getReliabilityByExternalId(
  exec: Executor,
  externalTestId: string,
): Promise<ReliabilityRow | null> {
  const { rows } = await exec.query<ReliabilityRow>(
    'SELECT * FROM test_reliability_snapshots WHERE external_test_id = $1',
    [externalTestId],
  );
  return rows[0] ?? null;
}
