import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../db/pool.js', () => ({
  pool: {},
  pingDatabase: vi.fn(async () => ({ reachable: true, latencyMs: 1 })),
  closePool: vi.fn(async () => {}),
  createPool: vi.fn(),
}));

const mockGenerate = vi.fn();
vi.mock('../ai/testGenerator.js', () => ({
  TestGenerator: class {
    async generate(input: unknown): Promise<unknown> {
      return mockGenerate(input);
    }
  },
}));

const mockGetProvider = vi.fn();
vi.mock('../ai/providerFactory.js', () => ({
  getConfiguredProvider: () => mockGetProvider(),
  resetProviderCache: vi.fn(),
}));

const { createApp } = await import('../app.js');
const { LLMProviderError } = await import('../ai/providers/llmProvider.js');

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProvider.mockReturnValue({ name: 'fake', generate: vi.fn() });
});

const minimalModel = {
  id: 'app-1',
  baseUrl: 'http://127.0.0.1:9999/',
  discoveredAt: '2026-01-01T00:00:00Z',
  pages: [{ url: 'http://127.0.0.1:9999/app/login', path: '/app/login' }],
};

describe('POST /api/ai/generate-tests', () => {
  it('rejects malformed body', async () => {
    const app = createApp();
    const res = await request(app).post('/api/ai/generate-tests').send({});
    expect(res.status).toBe(400);
  });

  it('rejects unknown goal', async () => {
    const app = createApp();
    const res = await request(app).post('/api/ai/generate-tests').send({
      applicationModel: minimalModel,
      goal: 'novel',
    });
    expect(res.status).toBe(400);
  });

  it('returns provider_error 200 when API key missing', async () => {
    mockGetProvider.mockImplementation(() => {
      throw new LLMProviderError('no key', 'missing_api_key');
    });
    const app = createApp();
    const res = await request(app).post('/api/ai/generate-tests').send({
      applicationModel: minimalModel,
      goal: 'smoke',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('provider_error');
    expect(res.body.message).toContain('not configured');
    expect(res.body.tests).toEqual([]);
    expect(JSON.stringify(res.body)).not.toMatch(/API_KEY/);
  });

  it('forwards TestGenerator result on success', async () => {
    mockGenerate.mockResolvedValueOnce({
      status: 'success',
      tests: [
        {
          test: {
            id: 't',
            name: 't',
            targetUrl: 'http://127.0.0.1:9999/app/login',
            steps: [{ action: 'navigate', url: 'http://127.0.0.1:9999/app/login' }],
          },
          validationStatus: 'valid',
          issues: [],
        },
      ],
      warnings: [],
      provider: 'fake',
      model: 'fake-model',
      durationMs: 5,
    });
    const app = createApp();
    const res = await request(app).post('/api/ai/generate-tests').send({
      applicationModel: minimalModel,
      goal: 'smoke',
      maxTests: 2,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.tests).toHaveLength(1);
  });
});
