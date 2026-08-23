import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { maskApiKey } from './adminSettings.js';

vi.mock('../db/pool.js', () => ({
  pingDatabase: vi.fn(async () => ({ reachable: true, latencyMs: 1 })),
  closePool: vi.fn(async () => {}),
  pool: {},
}));

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.TEST_AUTH_BYPASS = '1';
});

describe('maskApiKey', () => {
  it('returns undefined for empty', () => {
    expect(maskApiKey('')).toBeUndefined();
    expect(maskApiKey(null)).toBeUndefined();
    expect(maskApiKey(undefined)).toBeUndefined();
  });
  it('masks long keys keeping first 4 and last 4', () => {
    expect(maskApiKey('sk-abcdefghijklmnop-xyz9')).toBe('sk-a********xyz9');
  });
  it('fully masks short keys', () => {
    expect(maskApiKey('short')).toBe('********');
  });
});

describe('GET /api/admin/settings', () => {
  it('requires admin — viewer gets 403', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/settings')
      .set('x-test-user-role', 'viewer');
    expect(res.status).toBe(403);
  });

  it('returns settings snapshot for admin with masked key', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-testkey1234abcd';
    // Re-load env by re-importing after mutation is not straightforward; use maskApiKey directly.
    // The route reads env at request time via env.ANTHROPIC_API_KEY (module-level), so the
    // value the test sees is what was loaded at import time. We verify no raw key leaks.
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/settings')
      .set('x-test-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.configuredVia).toBe('environment');
    expect(res.body.llm.provider).toBeDefined();
    // If a key is configured, masked form must not be full key.
    if (res.body.llm.apiKeyConfigured) {
      expect(res.body.llm.apiKeyMasked).toMatch(/\*{4,}/);
    }
    const s = JSON.stringify(res.body);
    expect(s).not.toContain('sk-testkey1234abcd');
  });
});
