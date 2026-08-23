import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../db/pool.js', () => ({
  pool: {},
  pingDatabase: vi.fn(async () => ({ reachable: true, latencyMs: 1 })),
  closePool: vi.fn(async () => {}),
  createPool: vi.fn(),
}));

const mockAnalyze = vi.fn();
vi.mock('../ai/intelligence/bugIntelligenceService.js', () => ({
  BugIntelligenceService: class {
    async analyze(input: unknown): Promise<unknown> {
      return mockAnalyze(input);
    }
  },
}));
vi.mock('../ai/providerFactory.js', () => ({
  getConfiguredProvider: () => ({ name: 'fake', supportsImages: false, generate: vi.fn() }),
  resetProviderCache: vi.fn(),
}));

const mockList = vi.fn();
const mockGet = vi.fn();
const mockMembers = vi.fn();
const mockGetRun = vi.fn();

vi.mock('../db/repositories/bugClusterRepo.js', async () => {
  const actual = await vi.importActual<typeof import('../db/repositories/bugClusterRepo.js')>(
    '../db/repositories/bugClusterRepo.js',
  );
  return {
    ...actual,
    listClusters: (...a: unknown[]) => mockList(...a),
    getClusterById: (...a: unknown[]) => mockGet(...a),
    listMembersForCluster: (...a: unknown[]) => mockMembers(...a),
  };
});
vi.mock('../db/repositories/testRunRepo.js', () => ({
  getTestRunById: (...a: unknown[]) => mockGetRun(...a),
  listStepsForRun: vi.fn(),
  listHistoricalRuns: vi.fn(),
  listTestRuns: vi.fn(),
}));

const { createApp } = await import('../app.js');

beforeEach(() => {
  mockAnalyze.mockReset();
  mockList.mockReset();
  mockGet.mockReset();
  mockMembers.mockReset().mockResolvedValue([]);
  mockGetRun.mockReset();
});

describe('POST /api/ai/bug-intelligence/analyze', () => {
  it('returns summary', async () => {
    mockAnalyze.mockResolvedValueOnce({
      analyzedRuns: 5,
      candidatePairs: 3,
      aiComparisons: 0,
      deterministicStrongPairs: 2,
      clustersCreated: 1,
      clustersUpdated: 0,
      durationMs: 12,
      skippedReasons: {},
    });
    const app = createApp();
    const r = await request(app).post('/api/ai/bug-intelligence/analyze').send({});
    expect(r.status).toBe(200);
    expect(r.body.analyzedRuns).toBe(5);
  });

  it('rejects malformed body', async () => {
    const app = createApp();
    const r = await request(app).post('/api/ai/bug-intelligence/analyze').send({ since: 'nope' });
    expect(r.status).toBe(400);
  });
});

describe('GET /api/ai/bug-intelligence/clusters', () => {
  it('paginates', async () => {
    mockList.mockResolvedValueOnce({
      items: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          fingerprint_key: 'abc',
          title: 'x',
          description: null,
          status: 'open',
          severity: 'high',
          confidence: '0.90',
          first_seen_at: new Date(),
          last_seen_at: new Date(),
          occurrence_count: 1,
          affected_test_count: 1,
          affected_page_count: 1,
          affected_endpoint_count: 1,
          regression_status: 'first_seen',
          primary_run_id: null,
          primary_investigation_id: null,
          primary_failure_signature: 's',
          root_cause_summary: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      total: 1,
    });
    const app = createApp();
    const r = await request(app).get('/api/ai/bug-intelligence/clusters?page=1&limit=10');
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].confidence).toBe(0.9);
  });

  it('filters by status', async () => {
    mockList.mockResolvedValueOnce({ items: [], total: 0 });
    const app = createApp();
    const r = await request(app).get('/api/ai/bug-intelligence/clusters?status=regressed');
    expect(r.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'regressed' }));
  });

  it('rejects invalid status', async () => {
    const app = createApp();
    const r = await request(app).get('/api/ai/bug-intelligence/clusters?status=nonsense');
    expect(r.status).toBe(400);
  });
});

describe('GET /api/ai/bug-intelligence/clusters/:id', () => {
  it('400 for non-UUID', async () => {
    const app = createApp();
    const r = await request(app).get('/api/ai/bug-intelligence/clusters/nope');
    expect(r.status).toBe(400);
  });

  it('404 when missing', async () => {
    mockGet.mockResolvedValueOnce(null);
    const app = createApp();
    const r = await request(app).get('/api/ai/bug-intelligence/clusters/00000000-0000-0000-0000-000000000000');
    expect(r.status).toBe(404);
  });

  it('returns cluster with members and timeline', async () => {
    const now = new Date();
    mockGet.mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000001',
      fingerprint_key: 'abc',
      title: 'x',
      description: null,
      status: 'open',
      severity: 'high',
      confidence: '0.90',
      first_seen_at: now,
      last_seen_at: now,
      occurrence_count: 1,
      affected_test_count: 1,
      affected_page_count: 1,
      affected_endpoint_count: 1,
      regression_status: 'first_seen',
      primary_run_id: null,
      primary_investigation_id: null,
      primary_failure_signature: 's',
      root_cause_summary: null,
      created_at: now,
      updated_at: now,
    });
    mockMembers.mockResolvedValueOnce([
      {
        cluster_id: '00000000-0000-0000-0000-000000000001',
        test_run_id: '00000000-0000-0000-0000-000000000002',
        similarity_score: '0.75',
        membership_reason: [{ name: 'same_endpoint', contribution: 0.2, explanation: 'x' }],
        created_at: now,
      },
    ]);
    mockGetRun.mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000002',
      external_test_id: 't',
      test_name: 'test',
      status: 'failed',
      started_at: now,
      duration_ms: 100,
    });
    const app = createApp();
    const r = await request(app).get('/api/ai/bug-intelligence/clusters/00000000-0000-0000-0000-000000000001');
    expect(r.status).toBe(200);
    expect(r.body.members).toHaveLength(1);
    expect(r.body.timeline).toHaveLength(1);
    expect(r.body.timeline[0].kind).toBe('first_seen');
  });
});
