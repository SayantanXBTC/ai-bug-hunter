import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyIdToken = vi.fn();

vi.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp: () => ({ name: 'test-app' }),
  applicationDefault: () => ({}),
  cert: () => ({}),
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

const ORIGINAL = {
  json: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  gac: process.env.GOOGLE_APPLICATION_CREDENTIALS,
};

async function load(): Promise<typeof import('./firebaseAuth.js')> {
  vi.resetModules();
  return import('./firebaseAuth.js');
}

beforeEach(() => {
  verifyIdToken.mockReset();
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
});

afterEach(() => {
  vi.useRealTimers();
  if (ORIGINAL.json === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = ORIGINAL.json;
  if (ORIGINAL.gac === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  else process.env.GOOGLE_APPLICATION_CREDENTIALS = ORIGINAL.gac;
});

describe('verifyFirebaseIdToken', () => {
  it('skips the revocation check when no admin credentials are configured', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' });
    const { verifyFirebaseIdToken } = await load();
    await expect(verifyFirebaseIdToken('token')).resolves.toEqual({ uid: 'u1' });
    expect(verifyIdToken).toHaveBeenCalledWith('token', false);
  });

  it('checks revocation when a service account is configured', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'p' });
    verifyIdToken.mockResolvedValue({ uid: 'u1' });
    const { verifyFirebaseIdToken } = await load();
    await verifyFirebaseIdToken('token');
    expect(verifyIdToken).toHaveBeenCalledWith('token', true);
  });

  it('turns a credential failure into a misconfigured error', async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error('no creds'), { code: 'app/invalid-credential' }));
    const { verifyFirebaseIdToken, FirebaseVerifyError } = await load();
    const err = await verifyFirebaseIdToken('token').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FirebaseVerifyError);
    expect((err as InstanceType<typeof FirebaseVerifyError>).kind).toBe('misconfigured');
  });

  it('times out instead of hanging the request', async () => {
    vi.useFakeTimers();
    verifyIdToken.mockReturnValue(new Promise(() => undefined));
    const { verifyFirebaseIdToken, FirebaseVerifyError } = await load();
    const pending = verifyFirebaseIdToken('token').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await pending;
    expect(err).toBeInstanceOf(FirebaseVerifyError);
    expect((err as InstanceType<typeof FirebaseVerifyError>).kind).toBe('timeout');
  });

  it('passes token errors through for the route to map to 401', async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }));
    const { verifyFirebaseIdToken } = await load();
    await expect(verifyFirebaseIdToken('token')).rejects.toMatchObject({ code: 'auth/id-token-expired' });
  });
});
