import type { Pool } from 'pg';
import { logger } from '@ai-bug-hunter/test-engine';
import { calculateReliability } from './flakyScorer.js';
import type { TestReliability } from './reliabilityTypes.js';
import type { TestRunRecord } from '../../db/repositories/testRunRepo.js';
import { upsertReliability } from '../../db/repositories/testReliabilityRepo.js';

export interface ReliabilityServiceOptions {
  pool: Pool;
  minRuns: number;
  maxWindow?: number; // most recent N runs to consider per test
}

export class TestReliabilityService {
  constructor(private readonly opts: ReliabilityServiceOptions) {}

  async recalculateAll(): Promise<{ processed: number; snapshots: number }> {
    const { rows: testIds } = await this.opts.pool.query<{ external_test_id: string; test_name: string }>(
      `SELECT external_test_id, MAX(test_name) AS test_name FROM test_runs
       GROUP BY external_test_id`,
    );
    let snapshots = 0;
    for (const t of testIds) {
      const r = await this.recalculate(t.external_test_id, t.test_name);
      if (r) snapshots += 1;
    }
    logger.info('reliability:recalculate-all', { processed: testIds.length, snapshots });
    return { processed: testIds.length, snapshots };
  }

  async recalculate(externalTestId: string, fallbackName: string): Promise<TestReliability | null> {
    const { rows: runs } = await this.opts.pool.query<TestRunRecord>(
      `SELECT * FROM test_runs
       WHERE external_test_id = $1
       ORDER BY started_at ASC
       LIMIT $2`,
      [externalTestId, this.opts.maxWindow ?? 500],
    );

    // load environment metadata via evidence
    const envMap = new Map<string, { browserName: string | null; browserVersion: string | null }>();
    if (runs.length > 0) {
      const { rows: envRows } = await this.opts.pool.query<{ test_run_id: string; metadata: { name?: string; version?: string } }>(
        `SELECT test_run_id, metadata FROM evidence
         WHERE evidence_type = 'browser_metadata' AND test_run_id = ANY($1::uuid[])`,
        [runs.map((r) => r.id)],
      );
      for (const e of envRows) {
        envMap.set(e.test_run_id, {
          browserName: e.metadata?.name ?? null,
          browserVersion: e.metadata?.version ?? null,
        });
      }
    }

    // load bug cluster association
    const fpMap = new Map<string, { signature: string; bugClusterId: string | null }>();
    if (runs.length > 0) {
      const { rows: memberRows } = await this.opts.pool.query<{
        test_run_id: string;
        cluster_id: string;
        primary_failure_signature: string;
      }>(
        `SELECT m.test_run_id, m.cluster_id, c.primary_failure_signature
         FROM bug_cluster_members m
         JOIN bug_clusters c ON c.id = m.cluster_id
         WHERE m.test_run_id = ANY($1::uuid[])`,
        [runs.map((r) => r.id)],
      );
      for (const m of memberRows) {
        fpMap.set(m.test_run_id, {
          signature: m.primary_failure_signature ?? 'unknown',
          bugClusterId: m.cluster_id,
        });
      }
    }

    const reliability = calculateReliability({
      runs,
      externalTestId,
      testName: fallbackName,
      testCaseId: null,
      fingerprintByRunId: fpMap,
      environmentByRunId: envMap,
      minRuns: this.opts.minRuns,
    });

    await upsertReliability(this.opts.pool, reliability);
    logger.info('reliability:snapshot', {
      externalTestId,
      totalRuns: reliability.totalRuns,
      flakyScore: reliability.flakyScore,
      status: reliability.status,
    });
    return reliability;
  }
}

export function reliabilityFromRow(row: import('../../db/repositories/testReliabilityRepo.js').ReliabilityRow): TestReliability {
  const signalsPacket = (row.signals as { signals?: unknown; explanation?: string; failureSignatures?: unknown }) ?? {};
  return {
    testCaseId: row.test_case_id,
    externalTestId: row.external_test_id,
    testName: row.external_test_id,
    totalRuns: row.total_runs,
    passCount: row.pass_count,
    failureCount: row.failure_count,
    errorCount: row.error_count,
    passRate: row.total_runs === 0 ? 0 : row.pass_count / row.total_runs,
    failureRate: row.total_runs === 0 ? 0 : (row.failure_count + row.error_count) / row.total_runs,
    flakyScore: Number(row.flaky_score),
    reliabilityScore: Number(row.reliability_score),
    status: row.status as TestReliability['status'],
    firstRunAt: row.first_run_at ? row.first_run_at.toISOString() : null,
    lastRunAt: row.last_run_at ? row.last_run_at.toISOString() : null,
    consecutivePasses: 0,
    consecutiveFailures: 0,
    failureSignatures: (signalsPacket.failureSignatures as TestReliability['failureSignatures']) ?? [],
    durationStats: row.duration_stats as TestReliability['durationStats'],
    environmentSignals: row.environment_signals as TestReliability['environmentSignals'],
    signals: (signalsPacket.signals as TestReliability['signals']) ?? [],
    explanation: signalsPacket.explanation ?? '',
    calculatedAt: row.calculated_at.toISOString(),
  };
}
