import type { Pool, PoolClient } from 'pg';
import type { TestDefinition } from '@ai-bug-hunter/test-engine';

export type TestCasePriority = 'critical' | 'high' | 'medium' | 'low';
export type TestCaseSource = 'generated' | 'manual' | 'imported';

export interface TestCaseRow {
  id: string;
  application_id: string | null;
  name: string;
  description: string | null;
  target_url: string;
  definition: TestDefinition;
  priority: TestCasePriority;
  enabled: boolean;
  tags: string[];
  source: TestCaseSource;
  external_test_id: string | null;
  created_at: Date;
  updated_at: Date;
}

type Executor = Pool | PoolClient;

export interface InsertTestCaseInput {
  applicationId?: string | null;
  name: string;
  description?: string;
  targetUrl: string;
  definition: TestDefinition;
  priority?: TestCasePriority;
  enabled?: boolean;
  tags?: string[];
  source?: TestCaseSource;
  externalTestId?: string | null;
}

export async function insertTestCase(exec: Executor, input: InsertTestCaseInput): Promise<TestCaseRow> {
  const { rows } = await exec.query<TestCaseRow>(
    `INSERT INTO test_cases
       (application_id, name, description, target_url, definition,
        priority, enabled, tags, source, external_test_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      input.applicationId ?? null,
      input.name,
      input.description ?? null,
      input.targetUrl,
      input.definition,
      input.priority ?? 'medium',
      input.enabled ?? true,
      input.tags ?? [],
      input.source ?? 'manual',
      input.externalTestId ?? input.definition.id,
    ],
  );
  return rows[0]!;
}

export interface UpdateTestCaseInput {
  name?: string;
  description?: string | null;
  priority?: TestCasePriority;
  enabled?: boolean;
  tags?: string[];
  definition?: TestDefinition;
  targetUrl?: string;
}

export async function updateTestCase(
  exec: Executor,
  id: string,
  patch: UpdateTestCaseInput,
): Promise<TestCaseRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (col: string, val: unknown): void => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) add('name', patch.name);
  if (patch.description !== undefined) add('description', patch.description);
  if (patch.priority !== undefined) add('priority', patch.priority);
  if (patch.enabled !== undefined) add('enabled', patch.enabled);
  if (patch.tags !== undefined) add('tags', patch.tags);
  if (patch.definition !== undefined) add('definition', patch.definition);
  if (patch.targetUrl !== undefined) add('target_url', patch.targetUrl);
  if (sets.length === 0) return await getTestCaseById(exec, id);
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const { rows } = await exec.query<TestCaseRow>(
    `UPDATE test_cases SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function getTestCaseById(exec: Executor, id: string): Promise<TestCaseRow | null> {
  const { rows } = await exec.query<TestCaseRow>('SELECT * FROM test_cases WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listTestCases(
  exec: Executor,
  opts: { page: number; limit: number; applicationId?: string; enabled?: boolean; priority?: TestCasePriority; tag?: string },
): Promise<{ items: TestCaseRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const filters: string[] = [];
  const params: unknown[] = [];
  if (opts.applicationId) {
    params.push(opts.applicationId);
    filters.push(`application_id = $${params.length}`);
  }
  if (opts.enabled !== undefined) {
    params.push(opts.enabled);
    filters.push(`enabled = $${params.length}`);
  }
  if (opts.priority) {
    params.push(opts.priority);
    filters.push(`priority = $${params.length}`);
  }
  if (opts.tag) {
    params.push(opts.tag);
    filters.push(`$${params.length} = ANY(tags)`);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const filterCount = filters.length;
  params.push(opts.limit, offset);
  const items = await exec.query<TestCaseRow>(
    `SELECT * FROM test_cases ${where} ORDER BY priority ASC, updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const countRes = await exec.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM test_cases ${where}`,
    params.slice(0, filterCount),
  );
  return { items: items.rows, total: Number(countRes.rows[0]!.count) };
}
