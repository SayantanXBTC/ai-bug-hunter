import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  database: env.DATABASE_NAME,
  user: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export interface PingResult {
  reachable: boolean;
  latencyMs: number | null;
  error?: string;
}

export async function pingDatabase(): Promise<PingResult> {
  const started = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return { reachable: true, latencyMs: Date.now() - started };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      reachable: false,
      latencyMs: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
