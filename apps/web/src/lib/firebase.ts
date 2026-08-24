import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';

export interface FirebaseWebConfig {
  apiKey: string;
  appId: string;
  authDomain: string;
  projectId: string;
}

export interface PublicAuthConfig {
  googleAuthEnabled: boolean;
  firebase?: FirebaseWebConfig;
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export async function fetchPublicAuthConfig(): Promise<PublicAuthConfig> {
  const res = await fetch('/api/auth/public-config', { credentials: 'include' });
  if (!res.ok) return { googleAuthEnabled: false };
  return (await res.json()) as PublicAuthConfig;
}

function initFirebase(config: FirebaseWebConfig): Auth {
  if (cachedAuth) return cachedAuth;
  cachedApp = initializeApp(config);
  cachedAuth = getAuth(cachedApp);
  return cachedAuth;
}

/**
 * Trigger Google sign-in popup → return Firebase ID token that the
 * backend can verify + exchange for a session cookie.
 */
export async function signInWithGoogle(config: FirebaseWebConfig): Promise<string> {
  const auth = initFirebase(config);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user.getIdToken();
}
