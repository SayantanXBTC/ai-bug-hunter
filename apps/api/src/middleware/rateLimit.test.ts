import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit.js';
import { errorHandler } from './errorHandler.js';

function makeApp(windowMs: number, max: number) {
  const app = express();
  const limiter = createRateLimiter({ windowMs, max, keyFn: () => 'k' });
  app.get('/x', limiter, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('rateLimit', () => {
  it('allows under limit', async () => {
    const app = makeApp(1000, 3);
    for (let i = 0; i < 3; i += 1) {
      const r = await request(app).get('/x');
      expect(r.status).toBe(200);
    }
  });

  it('rejects at limit with 429 and Retry-After', async () => {
    const app = makeApp(1000, 2);
    await request(app).get('/x');
    await request(app).get('/x');
    const r = await request(app).get('/x');
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('rate_limited');
    expect(r.headers['retry-after']).toBeDefined();
  });

  it('sliding window releases after windowMs', async () => {
    const app = makeApp(50, 1);
    await request(app).get('/x');
    const r1 = await request(app).get('/x');
    expect(r1.status).toBe(429);
    await new Promise((r) => setTimeout(r, 80));
    const r2 = await request(app).get('/x');
    expect(r2.status).toBe(200);
  });
});
