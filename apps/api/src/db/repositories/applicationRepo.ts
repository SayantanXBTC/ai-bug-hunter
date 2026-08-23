import type { Pool, PoolClient } from 'pg';

export interface ApplicationRecord {
  id: string;
  name: string;
  base_url: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

type Executor = Pool | PoolClient;

export async function insertApplication(
  exec: Executor,
  input: { name: string; baseUrl: string; description?: string },
): Promise<ApplicationRecord> {
  const { rows } = await exec.query<ApplicationRecord>(
    `INSERT INTO applications (name, base_url, description)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [input.name, input.baseUrl, input.description ?? null],
  );
  return rows[0]!;
}

export async function listApplications(
  exec: Executor,
  page: number,
  limit: number,
): Promise<{ items: ApplicationRecord[]; total: number }> {
  const offset = (page - 1) * limit;
  const [items, countRes] = await Promise.all([
    exec.query<ApplicationRecord>(
      'SELECT * FROM applications ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    ),
    exec.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM applications'),
  ]);
  return { items: items.rows, total: Number(countRes.rows[0]!.count) };
}

export async function getApplicationById(
  exec: Executor,
  id: string,
): Promise<ApplicationRecord | null> {
  const { rows } = await exec.query<ApplicationRecord>(
    'SELECT * FROM applications WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}
