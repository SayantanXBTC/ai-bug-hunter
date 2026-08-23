import { describe, it, expect } from 'vitest';
import { createTestDb, testDbEnabled } from '../../db/testDb.js';
import { runMigrations } from '../../db/migrator.js';
import { insertTestCase } from '../../db/repositories/testCaseRepo.js';
import { insertApplication } from '../../db/repositories/applicationRepo.js';
import { LocalArtifactStore } from '../../artifacts/localArtifactStore.js';
import { TestRunPersistenceService } from '../../services/testRunPersistenceService.js';
import { RegressionCampaignService } from './regressionCampaignService.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutionResult, TestDefinition } from '@ai-bug-hunter/test-engine';
import { getCampaignById, listCampaignTests } from '../../db/repositories/regressionCampaignRepo.js';

interface Scenario {
  status: 'passed' | 'failed' | 'error';
  error?: { name: string; message: string; stepIndex?: number };
}

function fakeExecutor(scenarios: Map<string, Scenario>) {
  return {
    async run(def: TestDefinition): Promise<ExecutionResult> {
      const s = scenarios.get(def.id) ?? { status: 'passed' };
      const result: ExecutionResult = {
        testId: def.id,
        testName: def.name,
        status: s.status,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 10,
        steps: def.steps.map((step, i) => ({
          index: i,
          action: step.action,
          status: s.status === 'passed' ? 'passed' : i === 0 ? 'passed' : 'failed',
          durationMs: 5,
          ...(s.status !== 'passed' && i > 0 && s.error
            ? { error: { name: s.error.name, message: s.error.message } }
            : {}),
        })),
        ...(s.error ? { error: s.error } : {}),
      };
      return result;
    },
  };
}

describe.skipIf(!testDbEnabled())('RegressionCampaignService — integration', () => {
  it('creates a campaign (queued) but does not auto-execute', async () => {
    const db = await createTestDb();
    const dir = await mkdtemp(join(tmpdir(), 'aibh-camp-'));
    try {
      await runMigrations(db.pool);
      const app = await insertApplication(db.pool, { name: 'App', baseUrl: 'http://x/' });
      await insertTestCase(db.pool, {
        applicationId: app.id,
        name: 'tc1',
        targetUrl: 'http://x/',
        definition: { id: 'tc1', name: 'tc1', targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
        priority: 'critical',
      });

      const svc = new RegressionCampaignService({
        pool: db.pool,
        persistence: new TestRunPersistenceService(db.pool, new LocalArtifactStore(dir)),
        maxConcurrency: 1,
        maxAutoInvestigations: 0,
        executorFactory: () => fakeExecutor(new Map()) as never,
      });
      const preview = await svc.createCampaign({
        applicationId: app.id,
        strategy: 'all_enabled',
      });
      expect(preview.campaign.status).toBe('queued');
      expect(preview.selected.length).toBe(1);

      const stored = await getCampaignById(db.pool, preview.campaign.id);
      expect(stored?.status).toBe('queued');
    } finally {
      await rm(dir, { recursive: true, force: true });
      await db.close();
    }
  }, 30_000);

  it('runs sequentially, keeps going after failure, counts correctly', async () => {
    const db = await createTestDb();
    const dir = await mkdtemp(join(tmpdir(), 'aibh-camp-'));
    try {
      await runMigrations(db.pool);
      const app = await insertApplication(db.pool, { name: 'App', baseUrl: 'http://x/' });
      const t1 = await insertTestCase(db.pool, {
        applicationId: app.id,
        name: 't1',
        targetUrl: 'http://x/',
        definition: { id: 't1', name: 't1', targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
        priority: 'high',
      });
      const t2 = await insertTestCase(db.pool, {
        applicationId: app.id,
        name: 't2',
        targetUrl: 'http://x/',
        definition: { id: 't2', name: 't2', targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
        priority: 'medium',
      });
      const t3 = await insertTestCase(db.pool, {
        applicationId: app.id,
        name: 't3',
        targetUrl: 'http://x/',
        definition: { id: 't3', name: 't3', targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
        priority: 'low',
      });
      void t1;
      void t2;
      void t3;

      const scenarios = new Map<string, Scenario>();
      scenarios.set('t1', { status: 'passed' });
      scenarios.set('t2', { status: 'failed', error: { name: 'Err', message: 'boom', stepIndex: 0 } });
      scenarios.set('t3', { status: 'passed' });

      const svc = new RegressionCampaignService({
        pool: db.pool,
        persistence: new TestRunPersistenceService(db.pool, new LocalArtifactStore(dir)),
        maxConcurrency: 1,
        maxAutoInvestigations: 0,
        executorFactory: () => fakeExecutor(scenarios) as never,
      });
      const preview = await svc.createCampaign({ applicationId: app.id, strategy: 'all_enabled' });
      const finalRow = await svc.runCampaign(preview.campaign.id);
      expect(finalRow.status).toBe('failed');
      expect(finalRow.passed_runs).toBe(2);
      expect(finalRow.failed_runs).toBe(1);
      expect(finalRow.error_runs).toBe(0);
      const members = await listCampaignTests(db.pool, preview.campaign.id);
      expect(members.every((m) => m.status !== 'queued')).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await db.close();
    }
  }, 30_000);

  it('cancellation stops after current test finishes; remaining skipped', async () => {
    const db = await createTestDb();
    const dir = await mkdtemp(join(tmpdir(), 'aibh-camp-'));
    try {
      await runMigrations(db.pool);
      const app = await insertApplication(db.pool, { name: 'App', baseUrl: 'http://x/' });
      const ids = ['a', 'b', 'c', 'd'];
      for (const id of ids) {
        await insertTestCase(db.pool, {
          applicationId: app.id,
          name: id,
          targetUrl: 'http://x/',
          definition: { id, name: id, targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
        });
      }
      const scenarios = new Map<string, Scenario>();
      ids.forEach((id) => scenarios.set(id, { status: 'passed' }));

      const svc = new RegressionCampaignService({
        pool: db.pool,
        persistence: new TestRunPersistenceService(db.pool, new LocalArtifactStore(dir)),
        maxConcurrency: 1,
        maxAutoInvestigations: 0,
        executorFactory: () => {
          return {
            async run(def: TestDefinition): Promise<ExecutionResult> {
              // Cancel after t1 has "started". We simulate by triggering cancel on the b call:
              if (def.id === 'b') {
                await svc.cancelCampaign(preview.campaign.id);
              }
              const s = scenarios.get(def.id) ?? { status: 'passed' };
              return {
                testId: def.id,
                testName: def.name,
                status: s.status,
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
                durationMs: 5,
                steps: def.steps.map((step, i) => ({
                  index: i,
                  action: step.action,
                  status: 'passed',
                  durationMs: 1,
                })),
              };
            },
          } as never;
        },
      });
      const preview = await svc.createCampaign({ applicationId: app.id, strategy: 'all_enabled' });
      const finalRow = await svc.runCampaign(preview.campaign.id);
      expect(finalRow.status).toBe('cancelled');
      const members = await listCampaignTests(db.pool, preview.campaign.id);
      const statuses = members.map((m) => m.status);
      expect(statuses.filter((s) => s === 'skipped').length).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await db.close();
    }
  }, 30_000);

  it('quality=healthy when all pass; failed when critical fails; degraded when non-critical fails', async () => {
    const db = await createTestDb();
    const dir = await mkdtemp(join(tmpdir(), 'aibh-camp-'));
    try {
      await runMigrations(db.pool);
      const app = await insertApplication(db.pool, { name: 'App', baseUrl: 'http://x/' });
      const critical = await insertTestCase(db.pool, {
        applicationId: app.id,
        name: 'crit',
        targetUrl: 'http://x/',
        definition: { id: 'crit', name: 'crit', targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
        priority: 'critical',
      });
      const low = await insertTestCase(db.pool, {
        applicationId: app.id,
        name: 'low',
        targetUrl: 'http://x/',
        definition: { id: 'low', name: 'low', targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
        priority: 'low',
      });
      void critical;
      void low;

      const healthyScenarios = new Map<string, Scenario>();
      healthyScenarios.set('crit', { status: 'passed' });
      healthyScenarios.set('low', { status: 'passed' });
      const persistence = new TestRunPersistenceService(db.pool, new LocalArtifactStore(dir));

      const svc1 = new RegressionCampaignService({
        pool: db.pool,
        persistence,
        maxConcurrency: 1,
        maxAutoInvestigations: 0,
        executorFactory: () => fakeExecutor(healthyScenarios) as never,
      });
      const p1 = await svc1.createCampaign({ applicationId: app.id, strategy: 'all_enabled' });
      const r1 = await svc1.runCampaign(p1.campaign.id);
      expect(r1.quality).toBe('healthy');

      const degradedScenarios = new Map<string, Scenario>();
      degradedScenarios.set('crit', { status: 'passed' });
      degradedScenarios.set('low', { status: 'failed', error: { name: 'e', message: 'e' } });
      const svc2 = new RegressionCampaignService({
        pool: db.pool,
        persistence,
        maxConcurrency: 1,
        maxAutoInvestigations: 0,
        executorFactory: () => fakeExecutor(degradedScenarios) as never,
      });
      const p2 = await svc2.createCampaign({ applicationId: app.id, strategy: 'all_enabled' });
      const r2 = await svc2.runCampaign(p2.campaign.id);
      expect(r2.quality).toBe('degraded');

      const failedScenarios = new Map<string, Scenario>();
      failedScenarios.set('crit', { status: 'failed', error: { name: 'e', message: 'e' } });
      failedScenarios.set('low', { status: 'passed' });
      const svc3 = new RegressionCampaignService({
        pool: db.pool,
        persistence,
        maxConcurrency: 1,
        maxAutoInvestigations: 0,
        executorFactory: () => fakeExecutor(failedScenarios) as never,
      });
      const p3 = await svc3.createCampaign({ applicationId: app.id, strategy: 'all_enabled' });
      const r3 = await svc3.runCampaign(p3.campaign.id);
      expect(r3.quality).toBe('failed');
    } finally {
      await rm(dir, { recursive: true, force: true });
      await db.close();
    }
  }, 60_000);

  it('investigateFailed called only for failed runs', async () => {
    const db = await createTestDb();
    const dir = await mkdtemp(join(tmpdir(), 'aibh-camp-'));
    try {
      await runMigrations(db.pool);
      const app = await insertApplication(db.pool, { name: 'App', baseUrl: 'http://x/' });
      await insertTestCase(db.pool, {
        applicationId: app.id,
        name: 'p',
        targetUrl: 'http://x/',
        definition: { id: 'p', name: 'p', targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
      });
      await insertTestCase(db.pool, {
        applicationId: app.id,
        name: 'f',
        targetUrl: 'http://x/',
        definition: { id: 'f', name: 'f', targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
      });
      const scenarios = new Map<string, Scenario>();
      scenarios.set('p', { status: 'passed' });
      scenarios.set('f', { status: 'failed', error: { name: 'e', message: 'e' } });

      const called: string[] = [];
      const svc = new RegressionCampaignService({
        pool: db.pool,
        persistence: new TestRunPersistenceService(db.pool, new LocalArtifactStore(dir)),
        maxConcurrency: 1,
        maxAutoInvestigations: 5,
        executorFactory: () => fakeExecutor(scenarios) as never,
        investigateFailed: async (runId) => {
          called.push(runId);
        },
      });
      const p = await svc.createCampaign({ applicationId: app.id, strategy: 'all_enabled' });
      await svc.runCampaign(p.campaign.id);
      expect(called.length).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await db.close();
    }
  }, 30_000);

  it('respects maxAutoInvestigations cap', async () => {
    const db = await createTestDb();
    const dir = await mkdtemp(join(tmpdir(), 'aibh-camp-'));
    try {
      await runMigrations(db.pool);
      const app = await insertApplication(db.pool, { name: 'App', baseUrl: 'http://x/' });
      const ids = ['x1', 'x2', 'x3', 'x4'];
      for (const id of ids) {
        await insertTestCase(db.pool, {
          applicationId: app.id,
          name: id,
          targetUrl: 'http://x/',
          definition: { id, name: id, targetUrl: 'http://x/', steps: [{ action: 'navigate', url: 'http://x/' }] },
        });
      }
      const scenarios = new Map<string, Scenario>();
      ids.forEach((id) => scenarios.set(id, { status: 'failed', error: { name: 'e', message: 'e' } }));

      const called: string[] = [];
      const svc = new RegressionCampaignService({
        pool: db.pool,
        persistence: new TestRunPersistenceService(db.pool, new LocalArtifactStore(dir)),
        maxConcurrency: 1,
        maxAutoInvestigations: 2,
        executorFactory: () => fakeExecutor(scenarios) as never,
        investigateFailed: async (runId) => {
          called.push(runId);
        },
      });
      const p = await svc.createCampaign({ applicationId: app.id, strategy: 'all_enabled' });
      await svc.runCampaign(p.campaign.id);
      expect(called.length).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await db.close();
    }
  }, 30_000);
});
