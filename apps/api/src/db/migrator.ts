import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));

// Resolve migrations directory whether running from src (tsx) or dist.
function migrationsDir(): string {
  const candidates = [
    resolve(here, 'migrations'),
    resolve(here, '../src/db/migrations'),
    resolve(here, '../../src/db/migrations'),
  ];
  for (const c of candidates) {
    try {
      readdirSync(c);
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Migrations directory not found. Tried: ${candidates.join(', ')}`);
}

export interface Migration {
  version: string;
  name: string;
  sql: string;
}

export function loadMigrations(): Migration[] {
  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((filename) => {
    const match = /^(\d+)_(.+)\.sql$/.exec(filename);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    return {
      version: match[1]!,
      name: match[2]!,
      sql: readFileSync(resolve(dir, filename), 'utf8'),
    };
  });
}

export async function runMigrations(pool: Pool): Promise<{ applied: string[]; skipped: string[] }> {
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const existingRes = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations',
    );
    const existing = new Set(existingRes.rows.map((r) => r.version));

    for (const m of loadMigrations()) {
      if (existing.has(m.version)) {
        skipped.push(m.version);
        continue;
      }
      await applyOne(client, m);
      applied.push(m.version);
    }
  } finally {
    client.release();
  }
  return { applied, skipped };
}

async function applyOne(client: PoolClient, m: Migration): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(m.sql);
    await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
      m.version,
      m.name,
    ]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
