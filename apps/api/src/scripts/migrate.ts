import { closePool, pool } from '../db/pool.js';
import { runMigrations } from '../db/migrator.js';

async function main(): Promise<void> {
  const { applied, skipped } = await runMigrations(pool);
  console.log(
    JSON.stringify({ applied, skipped, appliedCount: applied.length, skippedCount: skipped.length }),
  );
}

main()
  .catch((err: unknown) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void closePool();
  });
