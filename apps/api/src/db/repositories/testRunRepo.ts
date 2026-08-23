import type { Pool, PoolClient } from 'pg';

export type ExecutionStatus = 'passed' | 'failed' | 'error';
export type StepStatus = 'passed' | 'failed' | 'skipped';

export interface TestRunRecord {
  id: string;
  test_case_id: string | null;
  external_test_id: string;
  test_name: string;
  status: ExecutionStatus;
  started_at: Date;
  finished_at: Date;
  duration_ms: number;
  error_name: string | null;
  error_message: string | null;
  error_step_index: number | null;
  owner_id: string | null;
  created_at: Date;
}

export interface Scope {
  ownerId: string;
  isAdmin: boolean;
}

export interface TestRunStepRecord {
  id: string;
  test_run_id: string;
  step_index: number;
  action: string;
  status: StepStatus;
  duration_ms: number;
  error_name: string | null;
  error_message: string | null;
  created_at: Date;
}

export interface InsertTestRunInput {
  testCaseId?: string | null;
  externalTestId: string;
  testName: string;
  status: ExecutionStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  error?: { name: string; message: string; stepIndex?: number };
  ownerId?: string | null;
}

export interface InsertStepInput {
  stepIndex: number;
  action: string;
  status: StepStatus;
  durationMs: number;
  error?: { name: string; message: string };
}

type Executor = Pool | PoolClient;

export async function insertTestRun(
  exec: Executor,
  input: InsertTestRunInput,
): Promise<TestRunRecord> {
  const { rows } = await exec.query<TestRunRecord>(
    `INSERT INTO test_runs
       (test_case_id, external_test_id, test_name, status,
        started_at, finished_at, duration_ms,
        error_name, error_message, error_step_index, owner_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      input.testCaseId ?? null,
      input.externalTestId,
      input.testName,
      input.status,
      input.startedAt,
      input.finishedAt,
      input.durationMs,
      input.error?.name ?? null,
      input.error?.message ?? null,
      input.error?.stepIndex ?? null,
      input.ownerId ?? null,
    ],
  );
  return rows[0]!;
}

export async function insertTestRunStep(
  exec: Executor,
  testRunId: string,
  input: InsertStepInput,
): Promise<TestRunStepRecord> {
  const { rows } = await exec.query<TestRunStepRecord>(
    `INSERT INTO test_run_steps
       (test_run_id, step_index, action, status, duration_ms, error_name, error_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      testRunId,
      input.stepIndex,
      input.action,
      input.status,
      input.durationMs,
      input.error?.name ?? null,
      input.error?.message ?? null,
    ],
  );
  return rows[0]!;
}

export async function getTestRunById(
  exec: Executor,
  id: string,
  scope?: Scope,
): Promise<TestRunRecord | null> {
  const { rows } = await exec.query<TestRunRecord>('SELECT * FROM test_runs WHERE id = $1', [id]);
  const row = rows[0] ?? null;
  if (!row) return null;
  if (scope && !scope.isAdmin && row.owner_id !== scope.ownerId) return null;
  return row;
}

export async function listTestRuns(
  exec: Executor,
  page: number,
  limit: number,
  scope?: Scope,
): Promise<{ items: TestRunRecord[]; total: number }> {
  const offset = (page - 1) * limit;
  const filterParams: unknown[] = [];
  let where = '';
  if (scope && !scope.isAdmin) {
    filterParams.push(scope.ownerId);
    where = `WHERE owner_id = $1`;
  }
  const params = [...filterParams, limit, offset];
  const [items, countRes] = await Promise.all([
    exec.query<TestRunRecord>(
      `SELECT * FROM test_runs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ),
    exec.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM test_runs ${where}`,
      filterParams,
    ),
  ]);
  return { items: items.rows, total: Number(countRes.rows[0]!.count) };
}

export async function listHistoricalRuns(
  exec: Executor,
  externalTestId: string,
  excludeRunId: string,
  limit: number,
): Promise<TestRunRecord[]> {
  const { rows } = await exec.query<TestRunRecord>(
    `SELECT * FROM test_runs
     WHERE external_test_id = $1 AND id <> $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [externalTestId, excludeRunId, limit],
  );
  return rows;
}

export async function listStepsForRun(
  exec: Executor,
  testRunId: string,
): Promise<TestRunStepRecord[]> {
  const { rows } = await exec.query<TestRunStepRecord>(
    'SELECT * FROM test_run_steps WHERE test_run_id = $1 ORDER BY step_index ASC',
    [testRunId],
  );
  return rows;
}
