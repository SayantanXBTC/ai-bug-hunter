import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool, pingDatabase, pool } from './db/pool.js';
import { runMigrations } from './db/migrator.js';

async function main(): Promise<void> {
  const app = createApp();

  const db = await pingDatabase();
  if (db.reachable) {
console.log(`[api] PostgreSQL reachable (${db.latencyMs}ms) at ${env.DATABASE_HOST}:${env.DATABASE_PORT}/${env.DATABASE_NAME}`);
    try {
      const { applied, skipped } = await runMigrations(pool);
console.log(`[api] migrations: ${applied.length} applied, ${skipped.length} already present`);
    } catch (err) {
console.error('[api] migration failed:', err);
      process.exit(1);
    }
  } else {
console.warn(`[api] PostgreSQL unreachable: ${db.error ?? 'unknown error'}`);
  }

  const server = app.listen(env.API_PORT, () => {
console.log(`[api] listening on http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
console.log(`[api] ${signal} received, shutting down`);
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((err: unknown) => {
  console.error('[api] fatal startup error:', err);
  process.exit(1);
});
