import { cert, getApps, initializeApp, type App, applicationDefault } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';

let cached: App | null = null;

/** Upper bound for verifying a Google ID token, so a stuck call fails cleanly instead of hanging the request. */
const VERIFY_TIMEOUT_MS = 10_000;

export class FirebaseVerifyError extends Error {
  constructor(
    message: string,
    readonly kind: 'timeout' | 'misconfigured',
  ) {
    super(message);
    this.name = 'FirebaseVerifyError';
  }
}

/** True when admin credentials are available (needed only for the revocation check). */
export function hasFirebaseAdminCredentials(): boolean {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return Boolean((json && json.trim().length > 0) || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

/**
 * Initialize Firebase Admin lazily. Two credential paths supported:
 *   1. GOOGLE_APPLICATION_CREDENTIALS env var (path to service account JSON) — auto.
 *   2. FIREBASE_SERVICE_ACCOUNT_JSON env var containing JSON directly.
 * If neither is set, falls back to ADC (works on Google Cloud runtimes).
 */
function getApp(): App {
  if (cached) return cached;
  const existing = getApps()[0];
  if (existing) {
    cached = existing;
    return existing;
  }
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson && rawJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawJson) as { project_id?: string };
      cached = initializeApp({
        credential: cert(parsed as never),
        projectId: parsed.project_id ?? (env.FIREBASE_PROJECT_ID || undefined),
      });
      return cached;
    } catch (err) {
      throw new FirebaseVerifyError(
        `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${(err as Error).message}`,
        'misconfigured',
      );
    }
  }
  cached = initializeApp({
    credential: applicationDefault(),
    projectId: env.FIREBASE_PROJECT_ID || undefined,
  });
  return cached;
}

/**
 * Verify a Firebase ID token.
 *
 * The signature check only needs Google's public keys, so it works on any
 * host. The revocation check calls the Firebase Admin API and needs a service
 * account; off Google Cloud, without one, the credential lookup fails or
 * stalls and the request dies with a bare 502. So revocation is checked only
 * when credentials are configured. The token is minted seconds earlier by the
 * sign-in popup and immediately exchanged for our own session, so skipping
 * the revocation check there is low risk.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = getApp();
  const checkRevoked = hasFirebaseAdminCredentials();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new FirebaseVerifyError('Timed out verifying Google sign-in', 'timeout')),
      VERIFY_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([getAuth(app).verifyIdToken(idToken, checkRevoked), timeout]);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'app/invalid-credential') {
      throw new FirebaseVerifyError(
        'Google sign-in is misconfigured on the server: Firebase admin credentials are invalid or missing',
        'misconfigured',
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function isFirebaseAuthEnabled(): boolean {
  return env.FIREBASE_AUTH_ENABLED === true;
}
