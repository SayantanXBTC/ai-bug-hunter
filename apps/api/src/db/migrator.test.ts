import { describe, it, expect } from 'vitest';
import { loadMigrations, runMigrations } from './migrator.js';
import { createTestDb, testDbEnabled } from './testDb.js';

describe('loadMigrations', () => {
  it('returns at least the initial schema migration', () => {
    const ms = loadMigrations();
    expect(ms.length).toBeGreaterThan(0);
    expect(ms[0]!.version).toBe('001');
    expect(ms[0]!.sql).toMatch(/CREATE TABLE .* applications/i);
  });
});

describe.skipIf(!testDbEnabled())('runMigrations (integration)', () => {
  it('creates all core tables and is idempotent', async () => {
    const db = await createTestDb();
    try {
      const r1 = await runMigrations(db.pool);
      const r2 = await runMigrations(db.pool);

      // Second run applies nothing.
      expect(r2.applied).toHaveLength(0);
      expect(r2.skipped.length).toBeGreaterThanOrEqual(r1.applied.length);

      const { rows } = await db.pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1
         ORDER BY table_name`,
        [db.schema],
      );
      const names = rows.map((r) => r.table_name);
      for (const t of [
        'applications',
        'artifacts',
        'evidence',
        'schema_migrations',
        'test_cases',
        'test_run_steps',
        'test_runs',
      ]) {
        expect(names).toContain(t);
      }
    } finally {
      await db.close();
    }
  }, 30_000);

  it('enforces status CHECK constraint on test_runs', async () => {
    const db = await createTestDb();
    try {
      await expect(
        db.pool.query(
          `INSERT INTO test_runs (external_test_id, test_name, status, started_at, finished_at, duration_ms)
           VALUES ($1,$2,$3,NOW(),NOW(),$4)`,
          ['t', 't', 'nope', 1],
        ),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  }, 30_000);

  it('enforces UNIQUE(test_run_id, step_index)', async () => {
    const db = await createTestDb();
    try {
      const { rows } = await db.pool.query<{ id: string }>(
        `INSERT INTO test_runs (external_test_id, test_name, status, started_at, finished_at, duration_ms)
         VALUES ('t','t','passed',NOW(),NOW(),1) RETURNING id`,
      );
      const runId = rows[0]!.id;
      await db.pool.query(
        `INSERT INTO test_run_steps (test_run_id, step_index, action, status, duration_ms)
         VALUES ($1,0,'navigate','passed',1)`,
        [runId],
      );
      await expect(
        db.pool.query(
          `INSERT INTO test_run_steps (test_run_id, step_index, action, status, duration_ms)
           VALUES ($1,0,'click','passed',1)`,
          [runId],
        ),
      ).rejects.toThrow(/unique/i);
    } finally {
      await db.close();
    }
  }, 30_000);
});
