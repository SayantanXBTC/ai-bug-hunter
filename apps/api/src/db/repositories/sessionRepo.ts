import type { Pool, PoolClient } from 'pg';

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  user_agent: string | null;
  ip: string | null;
}

type Executor = Pool | PoolClient;

export interface InsertSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
}

export async function insertSession(exec: Executor, input: InsertSessionInput): Promise<SessionRow> {
  const { rows } = await exec.query<SessionRow>(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.userId, input.tokenHash, input.expiresAt, input.userAgent ?? null, input.ip ?? null],
  );
  return rows[0]!;
}

export async function findByTokenHash(exec: Executor, tokenHash: string): Promise<SessionRow | null> {
  const { rows } = await exec.query<SessionRow>(`SELECT * FROM sessions WHERE token_hash = $1`, [tokenHash]);
  return rows[0] ?? null;
}

export async function revokeByTokenHash(exec: Executor, tokenHash: string): Promise<void> {
  await exec.query(`UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash]);
}

export async function deleteExpired(exec: Executor): Promise<number> {
  const res = await exec.query(`DELETE FROM sessions WHERE expires_at < NOW()`);
  return res.rowCount ?? 0;
}
