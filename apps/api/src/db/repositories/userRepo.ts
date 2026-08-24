import type { Pool, PoolClient } from 'pg';

export type UserRole = 'admin' | 'qa_engineer' | 'viewer';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
  firebase_uid: string | null;
  avatar_url: string | null;
  display_name: string | null;
}

type Executor = Pool | PoolClient;

export interface CreateUserInput {
  email: string;
  passwordHash: string | null;
  role: UserRole;
  firebaseUid?: string | null;
  avatarUrl?: string | null;
  displayName?: string | null;
}

export async function createUser(exec: Executor, input: CreateUserInput): Promise<UserRow> {
  const { rows } = await exec.query<UserRow>(
    `INSERT INTO users (email, password_hash, role, firebase_uid, avatar_url, display_name)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      input.email,
      input.passwordHash,
      input.role,
      input.firebaseUid ?? null,
      input.avatarUrl ?? null,
      input.displayName ?? null,
    ],
  );
  return rows[0]!;
}

export async function findUserByEmail(exec: Executor, email: string): Promise<UserRow | null> {
  const { rows } = await exec.query<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
  return rows[0] ?? null;
}

export async function findUserByFirebaseUid(
  exec: Executor,
  firebaseUid: string,
): Promise<UserRow | null> {
  const { rows } = await exec.query<UserRow>(
    `SELECT * FROM users WHERE firebase_uid = $1`,
    [firebaseUid],
  );
  return rows[0] ?? null;
}

export async function linkFirebaseUid(
  exec: Executor,
  userId: string,
  firebaseUid: string,
  avatarUrl: string | null,
  displayName: string | null,
): Promise<void> {
  await exec.query(
    `UPDATE users
       SET firebase_uid = $1,
           avatar_url = COALESCE($2, avatar_url),
           display_name = COALESCE($3, display_name),
           updated_at = NOW()
     WHERE id = $4`,
    [firebaseUid, avatarUrl, displayName, userId],
  );
}

export async function findUserById(exec: Executor, id: string): Promise<UserRow | null> {
  const { rows } = await exec.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function updateLastLogin(exec: Executor, id: string): Promise<void> {
  await exec.query(`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
}

export async function countUsers(exec: Executor): Promise<number> {
  const { rows } = await exec.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`);
  return Number(rows[0]!.count);
}
