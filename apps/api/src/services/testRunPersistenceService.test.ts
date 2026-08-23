import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestDb, testDbEnabled } from '../db/testDb.js';
import { LocalArtifactStore } from '../artifacts/localArtifactStore.js';
import { TestRunPersistenceService } from './testRunPersistenceService.js';
import type { ExecutionResult } from '@ai-bug-hunter/test-engine';

async function withTempStore(): Promise<{ store: LocalArtifactStore; path: string; cleanup: () => Promise<void> }> {
  const path = await mkdtemp(join(tmpdir(), 'aibh-'));
  return {
    store: new LocalArtifactStore(path),
    path,
    cleanup: async () => {
      await rm(path, { recursive: true, force: true });
    },
  };
}

function makeResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    testId: 't-1',
    testName: 'sample',
    status: 'failed',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 123,
    steps: [
      { index: 0, action: 'navigate', status: 'passed', durationMs: 20 },
      {
        index: 1,
        action: 'click',
        status: 'failed',
        durationMs: 100,
        error: { name: 'TimeoutError', message: 'boom' },
      },
    ],
    error: { name: 'TimeoutError', message: 'boom', stepIndex: 1 },
    evidence: {
      id: 'ev-1',
      collectedAt: new Date().toISOString(),
      testId: 't-1',
      failingStepIndex: 1,
      browser: {
        name: 'chromium',
        version: '150',
        userAgent: 'ua',
        viewport: { width: 800, height: 600 },
        url: 'http://x',
        title: 'x',
      },
      screenshot: {
        mimeType: 'image/png',
        encoding: 'base64',
        data: Buffer.from('PNG-fake-bytes').toString('base64'),
        byteLength: 14,
        capturedAt: new Date().toISOString(),
      },
      dom: {
        html: '<html><body>hi</body></html>',
        truncated: false,
        byteLength: 28,
        capturedAt: new Date().toISOString(),
      },
      consoleLogs: [
        { type: 'error', text: 'oops', timestamp: new Date().toISOString() },
      ],
      pageErrors: [],
      networkRequests: [
        {
          url: 'http://x/api',
          method: 'GET',
          resourceType: 'fetch',
          timestamp: new Date().toISOString(),
          status: 500,
          failure: { type: 'http', status: 500 },
        },
      ],
      failedRequests: [
        {
          url: 'http://x/api',
          method: 'GET',
          resourceType: 'fetch',
          timestamp: new Date().toISOString(),
          status: 500,
          failure: { type: 'http', status: 500 },
        },
      ],
      metadata: {
        truncated: { console: false, network: false, dom: false },
        counts: { consoleLogs: 1, pageErrors: 0, networkRequests: 1, failedRequests: 1 },
      },
    },
    ...overrides,
  };
}

describe.skipIf(!testDbEnabled())('TestRunPersistenceService (integration)', () => {
  it('persists a failed run with screenshot + dom artifacts on disk', async () => {
    const db = await createTestDb();
    const tmp = await withTempStore();
    try {
      const svc = new TestRunPersistenceService(db.pool, tmp.store);
      const persisted = await svc.persist(makeResult());

      expect(persisted.run.status).toBe('failed');
      expect(persisted.steps).toHaveLength(2);
      expect(persisted.steps[1]!.status).toBe('failed');

      const types = persisted.evidence.map((e) => e.evidence_type).sort();
      expect(types).toEqual(
        ['browser_metadata', 'console', 'dom', 'network', 'screenshot'].sort(),
      );

      // Artifacts live outside the DB.
      const { rows } = await db.pool.query<{ storage_key: string; sha256: string; content_type: string; byte_size: string }>(
        'SELECT storage_key, sha256, content_type, byte_size FROM artifacts',
      );
      expect(rows).toHaveLength(2);
      for (const a of rows) {
        expect(a.storage_key).not.toContain('..');
        expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
        const info = await stat(join(tmp.path, a.storage_key));
        expect(info.size).toBe(Number(a.byte_size));
      }
    } finally {
      await tmp.cleanup();
      await db.close();
    }
  }, 30_000);

  it('persists a passed run without evidence when none provided', async () => {
    const db = await createTestDb();
    const tmp = await withTempStore();
    try {
      const svc = new TestRunPersistenceService(db.pool, tmp.store);
      const res = makeResult({
        status: 'passed',
        error: undefined,
        evidence: undefined,
        steps: [{ index: 0, action: 'navigate', status: 'passed', durationMs: 5 }],
      });
      const persisted = await svc.persist(res);
      expect(persisted.run.status).toBe('passed');
      expect(persisted.evidence).toHaveLength(0);
      const { rows } = await db.pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM artifacts');
      expect(rows[0]!.count).toBe('0');
    } finally {
      await tmp.cleanup();
      await db.close();
    }
  }, 30_000);
});
