import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { API_SERVICE_NAME } from '@ai-bug-hunter/shared';

vi.mock('../db/pool.js', () => ({
  pingDatabase: vi.fn(async () => ({ reachable: true, latencyMs: 3 })),
  closePool: vi.fn(async () => {}),
  pool: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/health', () => {
  it('returns ok status and service name', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: API_SERVICE_NAME });
  });
});

describe('GET /api/health/detailed', () => {
  it('returns ok when DB reachable', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health/detailed');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database.reachable).toBe(true);
    expect(res.body.service).toBe(API_SERVICE_NAME);
    expect(res.body.llmProvider).toBeDefined();
    expect(['configured', 'fake_fallback', 'disabled', 'error']).toContain(res.body.llmProvider.status);
    expect(res.body.artifactStorage).toBeDefined();
    expect(typeof res.body.artifactStorage.ok).toBe('boolean');
    expect(res.body.browserAvailable).toBeDefined();
    // No secret echo
    const s = JSON.stringify(res.body);
    expect(s).not.toContain('ANTHROPIC_API_KEY');
    expect(s).not.toMatch(/sk-[A-Za-z0-9]+/);
  });

  it('returns degraded when DB unreachable', async () => {
    const { pingDatabase } = await import('../db/pool.js');
    vi.mocked(pingDatabase).mockResolvedValueOnce({
      reachable: false,
      latencyMs: null,
      error: 'boom',
    });
    const app = createApp();
    const res = await request(app).get('/api/health/detailed');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.database.reachable).toBe(false);
  });
});

describe('unknown route', () => {
  it('returns 404 JSON', async () => {
    const app = createApp();
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    expect(res.body.error.message).toBe('Not Found');
  });
});
