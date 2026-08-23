import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

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
    DiscoveryEngine: class {
      async discover(opts: { baseUrl: string }): Promise<unknown> {
        return {
          application: {
            id: '00000000-0000-0000-0000-000000000001',
            baseUrl: opts.baseUrl,
            discoveredAt: '2026-01-01T00:00:00.000Z',
            pages: [],
          },
          stats: {
            pagesVisited: 0,
            pagesDiscovered: 0,
            linksFound: 0,
            interactiveElements: 0,
            forms: 0,
            crawlDurationMs: 5,
          },
          warnings: [],
        };
      }
    },
  };
});

const { createApp } = await import('../app.js');

beforeEach(() => vi.clearAllMocks());

describe('POST /api/discovery', () => {
  it('rejects malformed body', async () => {
    const app = createApp();
    const res = await request(app).post('/api/discovery').send({ foo: 'bar' });
    expect(res.status).toBe(400);
  });

  it('rejects file:// URL', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/discovery')
      .send({ baseUrl: 'file:///etc/passwd' });
    expect(res.status).toBe(400);
  });

  it('rejects malformed URL', async () => {
    const app = createApp();
    const res = await request(app).post('/api/discovery').send({ baseUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('accepts a valid request and returns DiscoveryResult', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/discovery')
      .send({ baseUrl: 'https://example.com', maxPages: 2, maxDepth: 1 });
    expect(res.status).toBe(200);
    expect(res.body.application.baseUrl).toBe('https://example.com');
    expect(res.body.stats).toBeDefined();
    expect(res.body.warnings).toEqual([]);
  });
});
