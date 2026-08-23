import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDemoApp } from './server.js';

describe('demo-app normal mode', () => {
  const app = createDemoApp({ mode: 'normal' });

  it('healthz returns mode', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, mode: 'normal' });
  });

  it('login rejects wrong password', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'demo@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('login accepts correct credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'demo@example.com', password: 'demo1234' });
    expect(res.status).toBe(200);
  });

  it('cart total is correct', async () => {
    const s = 's1';
    await request(app).post('/cart/add').set('x-demo-session', s).send({ id: 'sku-1' });
    await request(app).post('/cart/add').set('x-demo-session', s).send({ id: 'sku-1' });
    const res = await request(app).get('/cart').set('x-demo-session', s).set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeCloseTo(19.98, 2);
  });

  it('checkout with sku-broken succeeds in normal mode', async () => {
    const s = 's2';
    await request(app).post('/cart/add').set('x-demo-session', s).send({ id: 'sku-broken' });
    const res = await request(app).post('/checkout').set('x-demo-session', s).send({});
    expect(res.status).toBe(200);
  });

  it('search never fails in normal mode', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get('/search').query({ q: 'anything' });
      expect(res.status).toBe(200);
    }
  });

  it('slow route exists', async () => {
    // In normal mode should return immediately.
    const res = await request(app).get('/slow');
    expect(res.status).toBe(200);
  });

  it('runtime mode switch forbidden by default', async () => {
    const res = await request(app).post('/__mode').send({ mode: 'buggy' });
    expect(res.status).toBe(403);
  });
});

describe('demo-app buggy mode', () => {
  const app = createDemoApp({ mode: 'buggy' });

  it('BUG-1: login accepts any password for demo user', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'demo@example.com', password: 'anything-goes' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('BUG-2: checkout with sku-broken returns 500', async () => {
    const s = 's3';
    await request(app).post('/cart/add').set('x-demo-session', s).send({ id: 'sku-broken' });
    const res = await request(app).post('/checkout').set('x-demo-session', s).send({});
    expect(res.status).toBe(500);
  });

  it('BUG-2: checkout with only good items succeeds', async () => {
    const s = 's4';
    await request(app).post('/cart/add').set('x-demo-session', s).send({ id: 'sku-1' });
    const res = await request(app).post('/checkout').set('x-demo-session', s).send({});
    expect(res.status).toBe(200);
  });

  it('BUG-3: cart total is wrong (doubled)', async () => {
    const s = 's5';
    await request(app).post('/cart/add').set('x-demo-session', s).send({ id: 'sku-1' });
    const res = await request(app).get('/cart').set('x-demo-session', s).set('Accept', 'application/json');
    // Real 9.99, buggy = 9.99 * 2 * 1 = 19.98
    expect(res.body.total).toBeCloseTo(19.98, 2);
  });

  it('slow route configured (not invoked to avoid 15s wait)', () => {
    const routes = (app as unknown as { _router: { stack: { route?: { path: string } }[] } })._router.stack
      .map((l) => l.route?.path)
      .filter(Boolean);
    expect(routes).toContain('/slow');
  });
});

describe('demo-app flaky mode', () => {
  const app = createDemoApp({ mode: 'flaky' });

  it('BUG-4: every 3rd search request fails deterministically', async () => {
    const r1 = await request(app).get('/search').query({ q: 'x' });
    const r2 = await request(app).get('/search').query({ q: 'x' });
    const r3 = await request(app).get('/search').query({ q: 'x' });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(500);
  });

  it('flaky counter is per query key', async () => {
    const a1 = await request(app).get('/search').query({ q: 'a' });
    const b1 = await request(app).get('/search').query({ q: 'b' });
    expect(a1.status).toBe(200);
    expect(b1.status).toBe(200);
  });
});

describe('demo-app runtime mode switch', () => {
  it('allows switching when enabled', async () => {
    const app = createDemoApp({ mode: 'normal', allowRuntimeModeSwitch: true });
    const post = await request(app).post('/__mode').send({ mode: 'buggy' });
    expect(post.status).toBe(200);
    expect(post.body.mode).toBe('buggy');
    const health = await request(app).get('/healthz');
    expect(health.body.mode).toBe('buggy');
  });

  it('rejects invalid mode', async () => {
    const app = createDemoApp({ mode: 'normal', allowRuntimeModeSwitch: true });
    const res = await request(app).post('/__mode').send({ mode: 'nope' });
    expect(res.status).toBe(400);
  });
});
