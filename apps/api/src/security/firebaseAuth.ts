import { cert, getApps, initializeApp, type App, applicationDefault } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';

let cached: App | null = null;

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
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${(err as Error).message}`,
      );
    }
  }
  cached = initializeApp({
    credential: applicationDefault(),
    projectId: env.FIREBASE_PROJECT_ID || undefined,
  });
  return cached;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = getApp();
  return getAuth(app).verifyIdToken(idToken, true);
}

export function isFirebaseAuthEnabled(): boolean {
  return env.FIREBASE_AUTH_ENABLED === true;
}
