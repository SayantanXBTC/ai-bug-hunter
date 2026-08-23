import type { Pool, PoolClient } from 'pg';

type Executor = Pool | PoolClient;

export interface RecordAttemptInput {
  emailLower: string;
  ip?: string | null;
  success: boolean;
}

export async function recordAttempt(exec: Executor, input: RecordAttemptInput): Promise<void> {
  await exec.query(
    `INSERT INTO login_attempts (email_lower, ip, success) VALUES ($1,$2,$3)`,
    [input.emailLower, input.ip ?? null, input.success],
  );
}

export interface CountRecentInput {
  emailLower?: string;
  ip?: string | null;
  sinceIso: string;
  successOnly?: boolean;
  failuresOnly?: boolean;
}

export async function countRecent(exec: Executor, input: CountRecentInput): Promise<number> {
  const filters: string[] = ['created_at >= $1'];
  const params: unknown[] = [input.sinceIso];
  if (input.emailLower !== undefined) {
    params.push(input.emailLower);
    filters.push(`email_lower = $${params.length}`);
  }
  if (input.ip !== undefined && input.ip !== null) {
    params.push(input.ip);
    filters.push(`ip = $${params.length}`);
  }
  if (input.successOnly) filters.push(`success = true`);
  if (input.failuresOnly) filters.push(`success = false`);
  const { rows } = await exec.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM login_attempts WHERE ${filters.join(' AND ')}`,
    params,
  );
  return Number(rows[0]!.count);
}
