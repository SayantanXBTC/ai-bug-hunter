import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createTestDb, testDbEnabled, type TestDb } from '../db/testDb.js';

// These tests exercise auth for real; disable the test bypass locally.
const originalBypass = process.env.TEST_AUTH_BYPASS;
process.env.TEST_AUTH_BYPASS = '';

let db: TestDb | null = null;
let app: Express | null = null;

async function loadApp(): Promise<Express> {
  // Late import so env picks up TEST_AUTH_BYPASS=''.
  const { createApp } = await import('../app.js');
  return createApp();
}

// Redirect the global pool used by routes to point at the temporary schema.
async function overridePool(): Promise<void> {
  const dbPool = await import('../db/pool.js');
  Object.defineProperty(dbPool, 'pool', { value: db!.pool, configurable: true });
}

const maybe = testDbEnabled() ? describe : describe.skip;

maybe('auth routes', () => {
  beforeAll(async () => {
    db = await createTestDb();
    await overridePool();
    app = await loadApp();
  });
  afterAll(async () => {
    if (db) await db.close();
    process.env.TEST_AUTH_BYPASS = originalBypass ?? '';
  });
  beforeEach(async () => {
    await db!.pool.query('TRUNCATE users, sessions, login_attempts RESTART IDENTITY CASCADE');
  });

  it('registers a user', async () => {
    const res = await request(app!).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'apassword12',
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.role).toBe('viewer');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('rejects duplicate email', async () => {
    await request(app!).post('/api/auth/register').send({ email: 'a@b.com', password: 'apassword12' });
    const res = await request(app!).post('/api/auth/register').send({ email: 'a@b.com', password: 'apassword12' });
    expect(res.status).toBe(409);
  });

  it('rejects weak password', async () => {
    const res = await request(app!).post('/api/auth/register').send({ email: 'c@d.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('logs in and issues HttpOnly session cookie', async () => {
    await request(app!).post('/api/auth/register').send({ email: 'x@y.com', password: 'apassword12' });
    const res = await request(app!).post('/api/auth/login').send({ email: 'x@y.com', password: 'apassword12' });
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('abh_session=');
    expect(cookie).toContain('HttpOnly');
  });

  it('returns generic error on wrong password', async () => {
    await request(app!).post('/api/auth/register').send({ email: 'e@f.com', password: 'apassword12' });
    const res = await request(app!).post('/api/auth/login').send({ email: 'e@f.com', password: 'wrongpass12' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_credentials');
  });

  it('returns same generic error for unknown email', async () => {
    const res = await request(app!).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'apassword12' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_credentials');
  });

  it('rate-limits after 5 failed attempts', async () => {
    await request(app!).post('/api/auth/register').send({ email: 'rl@x.com', password: 'apassword12' });
    for (let i = 0; i < 5; i += 1) {
      await request(app!).post('/api/auth/login').send({ email: 'rl@x.com', password: 'wrongpass12' });
    }
    const res = await request(app!).post('/api/auth/login').send({ email: 'rl@x.com', password: 'apassword12' });
    expect(res.status).toBe(429);
  });

  it('/me requires auth then returns user', async () => {
    const unauth = await request(app!).get('/api/auth/me');
    expect(unauth.status).toBe(401);
    await request(app!).post('/api/auth/register').send({ email: 'm@e.com', password: 'apassword12' });
    const login = await request(app!).post('/api/auth/login').send({ email: 'm@e.com', password: 'apassword12' });
    const cookie = login.headers['set-cookie']?.[0] ?? '';
    const me = await request(app!).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('m@e.com');
  });

  it('logout clears cookie and revokes', async () => {
    await request(app!).post('/api/auth/register').send({ email: 'lo@x.com', password: 'apassword12' });
    const login = await request(app!).post('/api/auth/login').send({ email: 'lo@x.com', password: 'apassword12' });
    const cookie = login.headers['set-cookie']?.[0] ?? '';
    const logout = await request(app!).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0] ?? '').toContain('Max-Age=0');
    const me = await request(app!).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(401);
  });
});
