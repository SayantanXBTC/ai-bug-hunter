import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export interface PoolConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  schema?: string;
  max?: number;
}

export function createPool(cfg: PoolConfig = {}): pg.Pool {
  const useSsl =
    (process.env.DATABASE_SSL ?? '').toLowerCase() === 'true' ||
    process.env.NODE_ENV === 'production';
  const p = new Pool({
    host: cfg.host ?? env.DATABASE_HOST,
    port: cfg.port ?? env.DATABASE_PORT,
    database: cfg.database ?? env.DATABASE_NAME,
    user: cfg.user ?? env.DATABASE_USER,
    password: cfg.password ?? env.DATABASE_PASSWORD,
    max: cfg.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  if (cfg.schema) {
    const ident = cfg.schema.replace(/"/g, '""');
    p.on('connect', (client) => {
      void client.query(`SET search_path TO "${ident}", public`);
    });
  }
  return p;
}

export const pool = createPool();

export interface PingResult {
  reachable: boolean;
  latencyMs: number | null;
  error?: string;
}

export async function pingDatabase(p: pg.Pool = pool): Promise<PingResult> {
  const started = Date.now();
  try {
    const client = await p.connect();
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

export async function closePool(p: pg.Pool = pool): Promise<void> {
  await p.end();
}
