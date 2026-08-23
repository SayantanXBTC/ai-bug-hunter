import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createTestDb, testDbEnabled, type TestDb } from '../db/testDb.js';
import { hashToken } from '../security/tokens.js';

let db: TestDb | null = null;
let app: Express | null = null;

async function overridePool(): Promise<void> {
  const dbPool = await import('../db/pool.js');
  Object.defineProperty(dbPool, 'pool', { value: db!.pool, configurable: true });
}

const maybe = testDbEnabled() ? describe : describe.skip;

maybe('ci token routes', () => {
  beforeAll(async () => {
    process.env.TEST_AUTH_BYPASS = '1';
    db = await createTestDb();
    await overridePool();
    const { createApp } = await import('../app.js');
    app = createApp();
  });
  afterAll(async () => {
    if (db) await db.close();
  });
  beforeEach(async () => {
    await db!.pool.query('TRUNCATE ci_tokens RESTART IDENTITY CASCADE');
  });

  it('requires admin to create CI token', async () => {
    const res = await request(app!)
      .post('/api/ci-tokens')
      .set('x-test-user-role', 'qa_engineer')
      .send({ name: 'ci-1' });
    expect(res.status).toBe(403);
  });

  it('creates CI token and stores only the hash', async () => {
    const res = await request(app!)
      .post('/api/ci-tokens')
      .set('x-test-user-role', 'admin')
      .send({ name: 'ci-1' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    const raw = res.body.token as string;
    const { rows } = await db!.pool.query<{ token_hash: string }>('SELECT token_hash FROM ci_tokens');
    expect(rows[0]!.token_hash).toBe(hashToken(raw));
    expect(rows[0]!.token_hash).not.toBe(raw);
  });

  it('rejects revoked token', async () => {
    const create = await request(app!)
      .post('/api/ci-tokens')
      .set('x-test-user-role', 'admin')
      .send({ name: 'ci-2' });
    const id = create.body.id as string;
    const raw = create.body.token as string;
    const revoke = await request(app!)
      .post(`/api/ci-tokens/${id}/revoke`)
      .set('x-test-user-role', 'admin');
    expect(revoke.status).toBe(200);
    // Trying to use the revoked token on a CI endpoint.
    const use = await request(app!)
      .get(`/api/ci/regression/00000000-0000-0000-0000-000000000000/result`)
      .set('Authorization', `Bearer ${raw}`);
    expect(use.status).toBe(401);
  });
});
