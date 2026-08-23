/**
 * Tenant isolation integration test.
 *
 * Runs against a real Postgres schema (gated by RUN_DB_TESTS=1 +
 * DATABASE_PASSWORD). Uses the createTestDb helper to spin up an isolated
 * schema, applies all migrations, seeds two users, and asserts that userB
 * cannot read/mutate userA's rows across the primary tenant surfaces.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, testDbEnabled, type TestDb } from '../db/testDb.js';
import { createUser } from '../db/repositories/userRepo.js';
import { insertApplication } from '../db/repositories/applicationRepo.js';
import { insertTestCase } from '../db/repositories/testCaseRepo.js';
import { insertTestRun } from '../db/repositories/testRunRepo.js';
import { upsertCluster } from '../db/repositories/bugClusterRepo.js';
import { insertCampaign } from '../db/repositories/regressionCampaignRepo.js';

const maybe = testDbEnabled() ? describe : describe.skip;

maybe('tenant isolation', () => {
  let db: TestDb | null = null;
  let userA = '';
  let userB = '';
  let app: import('express').Express;
  let appId = '';
  let tcId = '';
  let runId = '';
  let clusterId = '';
  let campaignId = '';

  beforeAll(async () => {
    db = await createTestDb();
    // Rebind pool module to the test schema pool before importing app.
    vi.doMock('../db/pool.js', () => ({
      pool: db!.pool,
      pingDatabase: async () => ({ reachable: true, latencyMs: 1 }),
      closePool: async () => {},
      createPool: () => db!.pool,
    }));
    process.env.NODE_ENV = 'test';
    process.env.TEST_AUTH_BYPASS = '1';
    const { createApp } = await import('../app.js');
    app = createApp();

    const uA = await createUser(db!.pool, {
      email: 'a@tenant.com',
      passwordHash: 'x',
      role: 'qa_engineer',
    });
    const uB = await createUser(db!.pool, {
      email: 'b@tenant.com',
      passwordHash: 'x',
      role: 'qa_engineer',
    });
    userA = uA.id;
    userB = uB.id;

    // Seed as userA (direct repo writes).
    const application = await insertApplication(db!.pool, {
      name: 'A-app',
      baseUrl: 'https://a.example.com',
      ownerId: userA,
    });
    appId = application.id;
    const tc = await insertTestCase(db!.pool, {
      applicationId: appId,
      name: 'A-test',
      targetUrl: 'https://a.example.com',
      definition: {
        id: 'tc-A',
        name: 'A-test',
        targetUrl: 'https://a.example.com',
        steps: [{ action: 'navigate', url: 'https://a.example.com' }],
      },
      ownerId: userA,
    });
    tcId = tc.id;
    const run = await insertTestRun(db!.pool, {
      testCaseId: tcId,
      externalTestId: 'tc-A',
      testName: 'A-test',
      status: 'failed',
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 100,
      error: { name: 'X', message: 'boom', stepIndex: 0 },
      ownerId: userA,
    });
    runId = run.id;
    const cluster = await upsertCluster(db!.pool, {
      fingerprintKey: 'fp-A',
      title: 'cluster A',
      description: null,
      status: 'open',
      severity: 'high',
      confidence: 0.9,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      occurrenceCount: 1,
      affectedTestCount: 1,
      affectedPageCount: 1,
      affectedEndpointCount: 1,
      regressionStatus: 'first_seen',
      primaryRunId: runId,
      primaryInvestigationId: null,
      primaryFailureSignature: 'X',
      rootCauseSummary: null,
      ownerId: userA,
    });
    clusterId = cluster.id;
    const campaign = await insertCampaign(db!.pool, {
      applicationId: appId,
      name: 'A-campaign',
      trigger: 'manual',
      strategy: 'all_enabled',
      requestedTestCount: 1,
      selectedTestCount: 1,
      ownerId: userA,
    });
    campaignId = campaign.id;
  });

  afterAll(async () => {
    if (db) await db.close();
    vi.doUnmock('../db/pool.js');
  });

  const asUser = (id: string): Record<string, string> => ({
    'x-test-user-id': id,
    'x-test-user-role': 'qa_engineer',
  });
  const asAdmin = (): Record<string, string> => ({
    'x-test-user-id': '00000000-0000-0000-0000-000000000099',
    'x-test-user-role': 'admin',
  });

  it('userB cannot see userA application (list empty, get 404)', async () => {
    const list = await request(app).get('/api/applications').set(asUser(userB));
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);

    const single = await request(app).get(`/api/applications/${appId}`).set(asUser(userB));
    expect(single.status).toBe(404);
  });

  it('userB cannot see userA test cases', async () => {
    const list = await request(app).get('/api/test-cases').set(asUser(userB));
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
    const single = await request(app).get(`/api/test-cases/${tcId}`).set(asUser(userB));
    expect(single.status).toBe(404);
  });

  it('userB cannot see userA test runs', async () => {
    const list = await request(app).get('/api/test-runs').set(asUser(userB));
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
    const single = await request(app).get(`/api/test-runs/${runId}`).set(asUser(userB));
    expect(single.status).toBe(404);
  });

  it('userB cannot see userA cluster', async () => {
    const list = await request(app).get('/api/ai/bug-intelligence/clusters').set(asUser(userB));
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
    const single = await request(app)
      .get(`/api/ai/bug-intelligence/clusters/${clusterId}`)
      .set(asUser(userB));
    expect(single.status).toBe(404);
  });

  it('userB cannot see userA campaign', async () => {
    const list = await request(app).get('/api/regression-campaigns').set(asUser(userB));
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
    const single = await request(app)
      .get(`/api/regression-campaigns/${campaignId}`)
      .set(asUser(userB));
    expect(single.status).toBe(404);
  });

  it('userB cannot delete userA application', async () => {
    const del = await request(app).delete(`/api/applications/${appId}`).set(asUser(userB));
    expect(del.status).toBe(404);
  });

  it('admin sees rows across owners', async () => {
    const apps = await request(app).get('/api/applications').set(asAdmin());
    expect(apps.status).toBe(200);
    expect(apps.body.items.some((a: { id: string }) => a.id === appId)).toBe(true);

    const campaigns = await request(app).get('/api/regression-campaigns').set(asAdmin());
    expect(campaigns.status).toBe(200);
    expect(campaigns.body.items.some((c: { id: string }) => c.id === campaignId)).toBe(true);
  });
});
