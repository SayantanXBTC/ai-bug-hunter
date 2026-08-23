import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, testDbEnabled, type TestDb } from '../testDb.js';
import { createUser, findUserByEmail, findUserById, updateLastLogin } from './userRepo.js';

let db: TestDb | null = null;
const maybe = testDbEnabled() ? describe : describe.skip;

maybe('userRepo', () => {
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    if (db) await db.close();
  });

  it('inserts and finds by email/id', async () => {
    const u = await createUser(db!.pool, { email: 'a@b.com', passwordHash: 'x', role: 'viewer' });
    const byEmail = await findUserByEmail(db!.pool, 'a@b.com');
    expect(byEmail?.id).toBe(u.id);
    const byId = await findUserById(db!.pool, u.id);
    expect(byId?.email).toBe('a@b.com');
  });

  it('email lookup is case-insensitive (CITEXT)', async () => {
    await createUser(db!.pool, { email: 'Case@X.com', passwordHash: 'x', role: 'viewer' });
    const found = await findUserByEmail(db!.pool, 'case@x.com');
    expect(found).not.toBeNull();
  });

  it('updates last_login_at', async () => {
    const u = await createUser(db!.pool, { email: 'll@x.com', passwordHash: 'x', role: 'viewer' });
    await updateLastLogin(db!.pool, u.id);
    const again = await findUserById(db!.pool, u.id);
    expect(again?.last_login_at).not.toBeNull();
  });
});
