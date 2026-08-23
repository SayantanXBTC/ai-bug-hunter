import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// --- module mocks (must be declared before importing app) ---

const mockPersist = vi.fn();
const mockList = vi.fn();
const mockGet = vi.fn();
const mockListSteps = vi.fn();
const mockListEvidence = vi.fn();
const mockGetArtifact = vi.fn();

vi.mock('../db/pool.js', () => ({
  pool: {},
  pingDatabase: vi.fn(async () => ({ reachable: true, latencyMs: 1 })),
  closePool: vi.fn(async () => {}),
  createPool: vi.fn(),
}));

vi.mock('@ai-bug-hunter/test-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-bug-hunter/test-engine')>();
  return {
    ...actual,
    TestExecutor: class {
      async run(def: { id: string; name: string }): Promise<unknown> {
        return {
          testId: def.id,
          testName: def.name,
          status: 'passed',
          startedAt: '2026-01-01T00:00:00.000Z',
          finishedAt: '2026-01-01T00:00:01.000Z',
          durationMs: 1000,
          steps: [{ index: 0, action: 'navigate', status: 'passed', durationMs: 500 }],
        };
      }
    },
  };
});

vi.mock('../services/testRunPersistenceService.js', () => ({
  TestRunPersistenceService: class {
    async persist(result: {
      testId: string;
      testName: string;
      status: string;
      steps: Array<{ index: number; action: string; status: string; durationMs: number }>;
    }): Promise<unknown> {
      return mockPersist(result);
    }
  },
}));

vi.mock('../db/repositories/testRunRepo.js', () => ({
  listTestRuns: (...args: unknown[]) => mockList(...args),
  getTestRunById: (...args: unknown[]) => mockGet(...args),
  listStepsForRun: (...args: unknown[]) => mockListSteps(...args),
}));

vi.mock('../db/repositories/evidenceRepo.js', () => ({
  listEvidenceForRun: (...args: unknown[]) => mockListEvidence(...args),
  getArtifactById: (...args: unknown[]) => mockGetArtifact(...args),
  getEvidenceById: vi.fn(),
}));

const { createApp } = await import('../app.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/test-runs', () => {
  it('rejects malformed body', async () => {
    const app = createApp();
    const res = await request(app).post('/api/test-runs').send({ id: 'x' });
    expect(res.status).toBe(400);
  });

  it('rejects file:// URL', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/test-runs')
      .send({
        id: 't',
        name: 't',
        targetUrl: 'file:///etc/passwd',
        steps: [{ action: 'navigate', url: 'file:///etc/passwd' }],
      });
    expect(res.status).toBe(400);
  });

  it('executes, persists, and returns metadata (no base64)', async () => {
    mockPersist.mockResolvedValueOnce({
      run: {
        id: 'run-1',
        external_test_id: 't1',
        test_name: 'hello',
        status: 'passed',
        started_at: new Date('2026-01-01T00:00:00Z'),
        finished_at: new Date('2026-01-01T00:00:01Z'),
        duration_ms: 1000,
        error_name: null,
        error_message: null,
        error_step_index: null,
        created_at: new Date('2026-01-01T00:00:02Z'),
        test_case_id: null,
      },
      steps: [
        {
          id: 'step-a',
          test_run_id: 'run-1',
          step_index: 0,
          action: 'navigate',
          status: 'passed',
          duration_ms: 500,
          error_name: null,
          error_message: null,
          created_at: new Date(),
        },
      ],
      evidence: [],
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/test-runs')
      .send({
        id: 't1',
        name: 'hello',
        targetUrl: 'https://example.com',
        steps: [{ action: 'navigate', url: 'https://example.com' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('run-1');
    expect(res.body.status).toBe('passed');
    expect(res.body.evidence).toEqual([]);
    // No base64 leaked.
    expect(JSON.stringify(res.body)).not.toMatch(/data":"[A-Za-z0-9+/]{200,}/);
  });
});

describe('GET /api/test-runs', () => {
  it('returns paginated list', async () => {
    mockList.mockResolvedValueOnce({
      items: [
        {
          id: 'r1',
          external_test_id: 't',
          test_name: 't',
          status: 'passed',
          started_at: new Date(),
          finished_at: new Date(),
          duration_ms: 10,
          error_name: null,
          error_message: null,
          error_step_index: null,
          created_at: new Date(),
          test_case_id: null,
        },
      ],
      total: 1,
    });
    const app = createApp();
    const res = await request(app).get('/api/test-runs?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(res.body.total).toBe(1);
  });

  it('rejects excessive limit', async () => {
    const app = createApp();
    const res = await request(app).get('/api/test-runs?limit=999999');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/test-runs/:id', () => {
  it('404 when not found', async () => {
    mockGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).get('/api/test-runs/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('400 when id is not a UUID', async () => {
    const app = createApp();
    const res = await request(app).get('/api/test-runs/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('returns detail with steps and evidence', async () => {
    mockGet.mockResolvedValueOnce({
      id: 'r1',
      external_test_id: 't',
      test_name: 't',
      status: 'failed',
      started_at: new Date(),
      finished_at: new Date(),
      duration_ms: 10,
      error_name: 'X',
      error_message: 'boom',
      error_step_index: 1,
      created_at: new Date(),
      test_case_id: null,
    });
    mockListSteps.mockResolvedValueOnce([
      {
        id: 's1',
        test_run_id: 'r1',
        step_index: 0,
        action: 'navigate',
        status: 'passed',
        duration_ms: 5,
        error_name: null,
        error_message: null,
        created_at: new Date(),
      },
    ]);
    mockListEvidence.mockResolvedValueOnce([
      {
        id: 'e1',
        test_run_id: 'r1',
        test_run_step_id: null,
        evidence_type: 'screenshot',
        artifact_id: 'a1',
        metadata: {},
        created_at: new Date(),
      },
    ]);
    mockGetArtifact.mockResolvedValueOnce({
      id: 'a1',
      storage_key: 'ab/uuid.png',
      content_type: 'image/png',
      byte_size: '1234',
      sha256: 'a'.repeat(64),
      created_at: new Date(),
    });

    const app = createApp();
    const res = await request(app).get('/api/test-runs/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    expect(res.body.error.name).toBe('X');
    expect(res.body.steps).toHaveLength(1);
    expect(res.body.evidence[0].type).toBe('screenshot');
    expect(res.body.evidence[0].downloadUrl).toBe('/api/evidence/e1');
    expect(res.body.evidence[0].contentType).toBe('image/png');
    // No storage_key leaked
    expect(JSON.stringify(res.body)).not.toMatch(/storage_key/);
  });
});
