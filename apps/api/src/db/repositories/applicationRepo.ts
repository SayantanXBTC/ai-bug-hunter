import type { Pool, PoolClient } from 'pg';

export interface ApplicationRecord {
  id: string;
  name: string;
  base_url: string;
  description: string | null;
  owner_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Ownership scope. When isAdmin=true, no WHERE filter is added. */
export interface Scope {
  ownerId: string;
  isAdmin: boolean;
}

type Executor = Pool | PoolClient;

export async function insertApplication(
  exec: Executor,
  input: { name: string; baseUrl: string; description?: string; ownerId?: string | null },
): Promise<ApplicationRecord> {
  const { rows } = await exec.query<ApplicationRecord>(
    `INSERT INTO applications (name, base_url, description, owner_id)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [input.name, input.baseUrl, input.description ?? null, input.ownerId ?? null],
  );
  return rows[0]!;
}

export async function listApplications(
  exec: Executor,
  page: number,
  limit: number,
  scope?: Scope,
): Promise<{ items: ApplicationRecord[]; total: number }> {
  const offset = (page - 1) * limit;
  const filterParams: unknown[] = [];
  let where = '';
  if (scope && !scope.isAdmin) {
    filterParams.push(scope.ownerId);
    where = `WHERE owner_id = $1`;
  }
  const params = [...filterParams, limit, offset];
  const [items, countRes] = await Promise.all([
    exec.query<ApplicationRecord>(
      `SELECT * FROM applications ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ),
    exec.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM applications ${where}`,
      filterParams,
    ),
  ]);
  return { items: items.rows, total: Number(countRes.rows[0]!.count) };
}

export async function getApplicationById(
  exec: Executor,
  id: string,
  scope?: Scope,
): Promise<ApplicationRecord | null> {
  const { rows } = await exec.query<ApplicationRecord>(
    'SELECT * FROM applications WHERE id = $1',
    [id],
  );
  const row = rows[0] ?? null;
  if (!row) return null;
  if (scope && !scope.isAdmin && row.owner_id !== scope.ownerId) return null;
  return row;
}

export async function deleteApplicationById(
  exec: Executor,
  id: string,
  scope?: Scope,
): Promise<boolean> {
  // Ownership pre-check.
  const existing = await getApplicationById(exec, id, scope);
  if (!existing) return false;
  const { rowCount } = await exec.query(`DELETE FROM applications WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function countChildrenForApplication(
  exec: Executor,
  id: string,
): Promise<{ testCases: number; testRuns: number }> {
  const [tcRes, trRes] = await Promise.all([
    exec.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM test_cases WHERE application_id = $1',
      [id],
    ),
    exec.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM test_runs r
       JOIN test_cases c ON r.test_case_id = c.id
       WHERE c.application_id = $1`,
      [id],
    ),
  ]);
  return {
    testCases: Number(tcRes.rows[0]!.count),
    testRuns: Number(trRes.rows[0]!.count),
  };
}
