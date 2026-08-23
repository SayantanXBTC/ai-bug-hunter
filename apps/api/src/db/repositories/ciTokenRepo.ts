import type { Pool, PoolClient } from 'pg';

export interface CiTokenRow {
  id: string;
  application_id: string | null;
  name: string;
  token_hash: string;
  created_by: string | null;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

type Executor = Pool | PoolClient;

export interface CreateCiTokenInput {
  applicationId?: string | null;
  name: string;
  tokenHash: string;
  createdBy?: string | null;
}

export async function createToken(exec: Executor, input: CreateCiTokenInput): Promise<CiTokenRow> {
  const { rows } = await exec.query<CiTokenRow>(
    `INSERT INTO ci_tokens (application_id, name, token_hash, created_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.applicationId ?? null, input.name, input.tokenHash, input.createdBy ?? null],
  );
  return rows[0]!;
}

export async function findByTokenHash(exec: Executor, tokenHash: string): Promise<CiTokenRow | null> {
  const { rows } = await exec.query<CiTokenRow>(`SELECT * FROM ci_tokens WHERE token_hash = $1`, [tokenHash]);
  return rows[0] ?? null;
}

export async function revokeById(exec: Executor, id: string): Promise<CiTokenRow | null> {
  const { rows } = await exec.query<CiTokenRow>(
    `UPDATE ci_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateLastUsed(exec: Executor, id: string): Promise<void> {
  await exec.query(`UPDATE ci_tokens SET last_used_at = NOW() WHERE id = $1`, [id]);
}

export async function listActive(
  exec: Executor,
  opts: { applicationId?: string } = {},
): Promise<CiTokenRow[]> {
  if (opts.applicationId) {
    const { rows } = await exec.query<CiTokenRow>(
      `SELECT * FROM ci_tokens WHERE application_id = $1 ORDER BY created_at DESC`,
      [opts.applicationId],
    );
    return rows;
  }
  const { rows } = await exec.query<CiTokenRow>(`SELECT * FROM ci_tokens ORDER BY created_at DESC`);
  return rows;
}

export async function getById(exec: Executor, id: string): Promise<CiTokenRow | null> {
  const { rows } = await exec.query<CiTokenRow>(`SELECT * FROM ci_tokens WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
