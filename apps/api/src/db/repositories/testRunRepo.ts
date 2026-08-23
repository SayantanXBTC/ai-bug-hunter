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
  created_at: Date;
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
        error_name, error_message, error_step_index)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
): Promise<TestRunRecord | null> {
  const { rows } = await exec.query<TestRunRecord>('SELECT * FROM test_runs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listTestRuns(
  exec: Executor,
  page: number,
  limit: number,
): Promise<{ items: TestRunRecord[]; total: number }> {
  const offset = (page - 1) * limit;
  const [items, countRes] = await Promise.all([
    exec.query<TestRunRecord>(
      'SELECT * FROM test_runs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    ),
    exec.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM test_runs'),
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
