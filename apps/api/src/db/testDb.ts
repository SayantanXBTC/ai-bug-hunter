import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createPool } from './pool.js';
import { runMigrations } from './migrator.js';

export interface TestDb {
  pool: Pool;
  schema: string;
  close(): Promise<void>;
}

export function testDbEnabled(): boolean {
  return process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_PASSWORD;
}

export async function createTestDb(): Promise<TestDb> {
  const schema = 'tdb_' + randomUUID().replace(/-/g, '').slice(0, 16);
  // Bootstrap: create schema using default connection (public search_path).
  const bootstrap = createPool();
  try {
    await bootstrap.query(`CREATE SCHEMA "${schema}"`);
  } finally {
    await bootstrap.end();
  }
  const pool = createPool({ schema });
  await runMigrations(pool);
  return {
    pool,
    schema,
    close: async () => {
      await pool.end();
      const drop = createPool();
      try {
        await drop.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await drop.end();
      }
    },
  };
}
