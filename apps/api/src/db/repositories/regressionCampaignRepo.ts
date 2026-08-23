import type { Pool, PoolClient } from 'pg';
import type {
  CampaignQuality,
  CampaignStatus,
  CampaignTrigger,
  SelectionStrategy,
} from '../../ai/regression/regressionTypes.js';

export interface RegressionCampaignRow {
  id: string;
  application_id: string | null;
  name: string;
  status: CampaignStatus;
  trigger: CampaignTrigger;
  selection_strategy: SelectionStrategy;
  requested_test_count: number;
  selected_test_count: number;
  started_at: Date | null;
  finished_at: Date | null;
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  error_runs: number;
  quality: CampaignQuality | null;
  cancel_requested: boolean;
  owner_id: string | null;
  created_at: Date;
}

/** Ownership scope. When isAdmin=true, no WHERE filter is added. */
export interface Scope {
  ownerId: string;
  isAdmin: boolean;
}

export interface CampaignTestRow {
  campaign_id: string;
  test_case_id: string;
  selection_score: string;
  selection_reason: unknown;
  execution_run_id: string | null;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'error' | 'skipped';
  started_at: Date | null;
  finished_at: Date | null;
  ordinal: number;
}

type Executor = Pool | PoolClient;

export interface InsertCampaignInput {
  applicationId: string | null;
  name: string;
  trigger: CampaignTrigger;
  strategy: SelectionStrategy;
  requestedTestCount: number;
  selectedTestCount: number;
  ownerId?: string | null;
}

export async function insertCampaign(exec: Executor, input: InsertCampaignInput): Promise<RegressionCampaignRow> {
  const { rows } = await exec.query<RegressionCampaignRow>(
    `INSERT INTO regression_campaigns
       (application_id, name, status, trigger, selection_strategy, requested_test_count, selected_test_count, owner_id)
     VALUES ($1,$2,'queued',$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      input.applicationId,
      input.name,
      input.trigger,
      input.strategy,
      input.requestedTestCount,
      input.selectedTestCount,
      input.ownerId ?? null,
    ],
  );
  return rows[0]!;
}

export async function insertCampaignTest(
  exec: Executor,
  input: {
    campaignId: string;
    testCaseId: string;
    selectionScore: number;
    selectionReason: unknown;
    ordinal: number;
  },
): Promise<void> {
  await exec.query(
    `INSERT INTO regression_campaign_tests
       (campaign_id, test_case_id, selection_score, selection_reason, ordinal)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (campaign_id, test_case_id) DO UPDATE SET
       selection_score = EXCLUDED.selection_score,
       selection_reason = EXCLUDED.selection_reason,
       ordinal = EXCLUDED.ordinal`,
    [
      input.campaignId,
      input.testCaseId,
      input.selectionScore,
      JSON.stringify(input.selectionReason),
      input.ordinal,
    ],
  );
}

export async function listCampaignTests(exec: Executor, campaignId: string): Promise<CampaignTestRow[]> {
  const { rows } = await exec.query<CampaignTestRow>(
    'SELECT * FROM regression_campaign_tests WHERE campaign_id = $1 ORDER BY ordinal ASC',
    [campaignId],
  );
  return rows;
}

export async function updateCampaign(
  exec: Executor,
  id: string,
  patch: Partial<{
    status: CampaignStatus;
    startedAt: Date | null;
    finishedAt: Date | null;
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    errorRuns: number;
    quality: CampaignQuality | null;
    cancelRequested: boolean;
  }>,
): Promise<RegressionCampaignRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown): void => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.startedAt !== undefined) push('started_at', patch.startedAt);
  if (patch.finishedAt !== undefined) push('finished_at', patch.finishedAt);
  if (patch.totalRuns !== undefined) push('total_runs', patch.totalRuns);
  if (patch.passedRuns !== undefined) push('passed_runs', patch.passedRuns);
  if (patch.failedRuns !== undefined) push('failed_runs', patch.failedRuns);
  if (patch.errorRuns !== undefined) push('error_runs', patch.errorRuns);
  if (patch.quality !== undefined) push('quality', patch.quality);
  if (patch.cancelRequested !== undefined) push('cancel_requested', patch.cancelRequested);
  if (sets.length === 0) return await getCampaignById(exec, id);
  params.push(id);
  const { rows } = await exec.query<RegressionCampaignRow>(
    `UPDATE regression_campaigns SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function updateCampaignTest(
  exec: Executor,
  campaignId: string,
  testCaseId: string,
  patch: Partial<{
    status: CampaignTestRow['status'];
    executionRunId: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown): void => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.executionRunId !== undefined) push('execution_run_id', patch.executionRunId);
  if (patch.startedAt !== undefined) push('started_at', patch.startedAt);
  if (patch.finishedAt !== undefined) push('finished_at', patch.finishedAt);
  if (sets.length === 0) return;
  params.push(campaignId, testCaseId);
  await exec.query(
    `UPDATE regression_campaign_tests SET ${sets.join(', ')}
     WHERE campaign_id = $${params.length - 1} AND test_case_id = $${params.length}`,
    params,
  );
}

export async function getCampaignById(
  exec: Executor,
  id: string,
  scope?: Scope,
): Promise<RegressionCampaignRow | null> {
  const { rows } = await exec.query<RegressionCampaignRow>(
    'SELECT * FROM regression_campaigns WHERE id = $1',
    [id],
  );
  const row = rows[0] ?? null;
  if (!row) return null;
  if (scope && !scope.isAdmin && row.owner_id !== scope.ownerId) return null;
  return row;
}

export async function listCampaigns(
  exec: Executor,
  opts: { page: number; limit: number; status?: CampaignStatus; applicationId?: string; scope?: Scope },
): Promise<{ items: RegressionCampaignRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const filters: string[] = [];
  const params: unknown[] = [];
  if (opts.scope && !opts.scope.isAdmin) {
    params.push(opts.scope.ownerId);
    filters.push(`owner_id = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    filters.push(`status = $${params.length}`);
  }
  if (opts.applicationId) {
    params.push(opts.applicationId);
    filters.push(`application_id = $${params.length}`);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const filterCount = filters.length;
  params.push(opts.limit, offset);
  const items = await exec.query<RegressionCampaignRow>(
    `SELECT * FROM regression_campaigns ${where} ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const countRes = await exec.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM regression_campaigns ${where}`,
    params.slice(0, filterCount),
  );
  return { items: items.rows, total: Number(countRes.rows[0]!.count) };
}
