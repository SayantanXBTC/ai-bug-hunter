import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Build a mock pool. Query response driven by query prefix.
function makeMockPool(runs: Array<Record<string, unknown>> = []): { query: ReturnType<typeof vi.fn> } {
  return {
    query: vi.fn(async (sql: string) => {
      const s = sql.trim();
      if (s.startsWith('SELECT COUNT(*)::text AS count FROM applications')) return { rows: [{ count: '0' }] };
      if (s.startsWith('SELECT COUNT(*)::text AS count FROM test_reliability_snapshots')) return { rows: [{ count: '0' }] };
      if (s.includes('FROM test_runs')) return { rows: runs };
      if (s.includes('FROM bug_clusters')) return { rows: [] };
      if (s.includes('FROM test_reliability_snapshots')) return { rows: [] };
      if (s.includes('FROM regression_campaigns')) return { rows: [] };
      return { rows: [] };
    }),
  };
}

vi.mock('../db/pool.js', () => {
  return {
    pingDatabase: vi.fn(async () => ({ reachable: true, latencyMs: 1 })),
    closePool: vi.fn(async () => {}),
    pool: makeMockPool(),
  };
});

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.TEST_AUTH_BYPASS = '1';
});

describe('GET /api/dashboard/overview', () => {
  it('returns zeros gracefully when DB empty', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app).get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.applications.count).toBe(0);
    expect(res.body.testRuns.totalRecent).toBe(0);
    expect(res.body.bugs.openClusters).toBe(0);
    expect(res.body.flakyTests.count).toBe(0);
    expect(res.body.recentCampaign).toBeNull();
    expect(res.body.qualityScore).toBeDefined();
    expect(res.body.qualityScore.score).toBeGreaterThanOrEqual(0);
    expect(res.body.qualityScore.warning).toBeDefined();
  });

  it('requires auth (401 when no user)', async () => {
    process.env.TEST_AUTH_BYPASS = '';
    // Need fresh app with no bypass
    vi.resetModules();
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app).get('/api/dashboard/overview');
    expect(res.status).toBe(401);
    process.env.TEST_AUTH_BYPASS = '1';
    vi.resetModules();
  });
});

describe('GET /api/dashboard/trends', () => {
  it('reports insufficient=true when no run data', async () => {
    vi.resetModules();
    process.env.TEST_AUTH_BYPASS = '1';
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app).get('/api/dashboard/trends?metric=passRate&window=7d');
    expect(res.status).toBe(200);
    expect(res.body.insufficient).toBe(true);
    expect(res.body.buckets).toHaveLength(7);
  });

  it('rejects invalid metric', async () => {
    vi.resetModules();
    process.env.TEST_AUTH_BYPASS = '1';
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app).get('/api/dashboard/trends?metric=bogus');
    expect(res.status).toBe(400);
  });
});
