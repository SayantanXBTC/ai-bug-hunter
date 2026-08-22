import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

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
          steps: [
            { index: 0, action: 'navigate', status: 'passed', durationMs: 500 },
          ],
        };
      }
    },
  };
});

vi.mock('../db/pool.js', () => ({
  pingDatabase: vi.fn(async () => ({ reachable: true, latencyMs: 1 })),
  closePool: vi.fn(async () => {}),
  pool: {},
}));

const { createApp } = await import('../app.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/test-runs', () => {
  it('rejects malformed body with 400', async () => {
    const app = createApp();
    const res = await request(app).post('/api/test-runs').send({ id: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid test definition/);
  });

  it('rejects file:// URL with 400', async () => {
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

  it('executes a valid test and returns ExecutionResult', async () => {
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
    expect(res.body.status).toBe('passed');
    expect(res.body.testId).toBe('t1');
    expect(res.body.steps).toHaveLength(1);
  });
});
