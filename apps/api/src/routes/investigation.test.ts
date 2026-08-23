import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../db/pool.js', () => ({
  pool: {},
  pingDatabase: vi.fn(async () => ({ reachable: true, latencyMs: 1 })),
  closePool: vi.fn(async () => {}),
  createPool: vi.fn(),
}));

const mockGetRun = vi.fn();
const mockListSteps = vi.fn();
const mockListEvidence = vi.fn();
const mockListHistorical = vi.fn();
const mockGetArtifact = vi.fn();
const mockGetExistingInv = vi.fn();
const mockUpsertInv = vi.fn();
const mockInvestigate = vi.fn();

vi.mock('../db/repositories/testRunRepo.js', () => ({
  getTestRunById: (...a: unknown[]) => mockGetRun(...a),
  listStepsForRun: (...a: unknown[]) => mockListSteps(...a),
  listHistoricalRuns: (...a: unknown[]) => mockListHistorical(...a),
}));
vi.mock('../db/repositories/evidenceRepo.js', () => ({
  listEvidenceForRun: (...a: unknown[]) => mockListEvidence(...a),
  getArtifactById: (...a: unknown[]) => mockGetArtifact(...a),
  insertArtifact: vi.fn(),
  insertEvidence: vi.fn(),
  getEvidenceById: vi.fn(),
}));
vi.mock('../db/repositories/investigationRepo.js', () => ({
  getInvestigationByTestRunId: (...a: unknown[]) => mockGetExistingInv(...a),
  upsertInvestigation: (...a: unknown[]) => mockUpsertInv(...a),
}));
vi.mock('../ai/investigation/failureInvestigator.js', () => ({
  FailureInvestigator: class {
    async investigate(input: unknown): Promise<unknown> {
      return mockInvestigate(input);
    }
  },
}));
vi.mock('../ai/providerFactory.js', () => ({
  getConfiguredProvider: () => ({ name: 'fake', supportsImages: true, generate: vi.fn() }),
  resetProviderCache: vi.fn(),
}));

const { createApp } = await import('../app.js');

beforeEach(() => {
  mockGetRun.mockReset();
  mockListSteps.mockReset().mockResolvedValue([]);
  mockListEvidence.mockReset().mockResolvedValue([]);
  mockListHistorical.mockReset().mockResolvedValue([]);
  mockGetArtifact.mockReset();
  mockGetExistingInv.mockReset();
  mockUpsertInv.mockReset();
  mockInvestigate.mockReset();
});

describe('POST /api/ai/investigate/:testRunId', () => {
  it('400 for invalid UUID', async () => {
    const app = createApp();
    const r = await request(app).post('/api/ai/investigate/not-a-uuid');
    expect(r.status).toBe(400);
  });

  it('404 when test run does not exist', async () => {
    mockGetExistingInv.mockResolvedValueOnce(null);
    mockGetRun.mockResolvedValueOnce(null);
    const app = createApp();
    const r = await request(app).post('/api/ai/investigate/00000000-0000-0000-0000-000000000000');
    expect(r.status).toBe(404);
  });

  it('returns not_investigable for passed runs (no LLM call)', async () => {
    mockGetExistingInv.mockResolvedValueOnce(null);
    mockGetRun.mockResolvedValueOnce({ id: 'r', status: 'passed', external_test_id: 't' });
    const app = createApp();
    const r = await request(app).post('/api/ai/investigate/00000000-0000-0000-0000-000000000001');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('not_investigable');
    expect(mockInvestigate).not.toHaveBeenCalled();
  });

  it('returns cached investigation if present', async () => {
    mockGetExistingInv.mockResolvedValueOnce({
      report_json: { id: 'inv-1', classification: 'application_defect' },
    });
    const app = createApp();
    const r = await request(app).post('/api/ai/investigate/00000000-0000-0000-0000-000000000002');
    expect(r.status).toBe(200);
    expect(r.body.cached).toBe(true);
    expect(r.body.report.id).toBe('inv-1');
    expect(mockGetRun).not.toHaveBeenCalled();
  });

  it('runs and persists on success', async () => {
    mockGetExistingInv.mockResolvedValueOnce(null);
    mockGetRun.mockResolvedValueOnce({ id: 'r-1', status: 'failed', external_test_id: 't1' });
    mockInvestigate.mockResolvedValueOnce({
      status: 'ok',
      report: {
        id: 'inv-1',
        testRunId: 'r-1',
        classification: 'application_defect',
        severity: 'high',
        confidence: 0.8,
        summary: 's',
        observedFacts: [],
        hypotheses: [],
        supportingEvidence: [],
        reproductionSteps: [],
        recommendedNextSteps: [],
        validationWarnings: [],
        generatedAt: '2026',
        provider: 'fake',
        model: 'fake',
        durationMs: 1,
        likelyRootCause: null,
        affectedArea: null,
      },
    });
    const app = createApp();
    const r = await request(app).post('/api/ai/investigate/00000000-0000-0000-0000-000000000003');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
    expect(mockUpsertInv).toHaveBeenCalledOnce();
  });

  it('force=true bypasses cache', async () => {
    mockGetExistingInv.mockResolvedValueOnce({ report_json: { id: 'cached' } });
    mockGetRun.mockResolvedValueOnce({ id: 'r-1', status: 'failed', external_test_id: 't1' });
    mockInvestigate.mockResolvedValueOnce({ status: 'ok', report: { id: 'fresh', testRunId: 'r-1', classification: 'inconclusive', severity: 'low', confidence: 0.3, summary: 's', observedFacts: [], hypotheses: [], supportingEvidence: [], reproductionSteps: [], recommendedNextSteps: [], validationWarnings: [], generatedAt: '2026', provider: 'fake', model: 'fake', durationMs: 1, likelyRootCause: null, affectedArea: null } });
    const app = createApp();
    const r = await request(app).post('/api/ai/investigate/00000000-0000-0000-0000-000000000004?force=true');
    expect(r.status).toBe(200);
    expect(r.body.report.id).toBe('fresh');
  });
});

describe('GET /api/ai/investigate/:testRunId', () => {
  it('404 when none', async () => {
    mockGetExistingInv.mockResolvedValueOnce(null);
    const app = createApp();
    const r = await request(app).get('/api/ai/investigate/00000000-0000-0000-0000-000000000005');
    expect(r.status).toBe(404);
  });
  it('returns existing report', async () => {
    mockGetExistingInv.mockResolvedValueOnce({ report_json: { id: 'inv-1' } });
    const app = createApp();
    const r = await request(app).get('/api/ai/investigate/00000000-0000-0000-0000-000000000006');
    expect(r.status).toBe(200);
    expect(r.body.report.id).toBe('inv-1');
  });
});
