import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import {
  createUser,
  findUserByEmail,
  findUserByFirebaseUid,
  linkFirebaseUid,
  updateLastLogin,
  type UserRole,
} from '../db/repositories/userRepo.js';
import { isFirebaseAuthEnabled, verifyFirebaseIdToken } from '../security/firebaseAuth.js';
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '../security/password.js';
import {
  clearSessionCookie,
  createSession,
  readSessionCookie,
  revokeSession,
  setSessionCookie,
} from '../security/session.js';
import { requireUser } from '../middleware/authenticate.js';
import { countRecent, recordAttempt } from '../db/repositories/loginAttemptRepo.js';
import { createRateLimiter, ipKey } from '../middleware/rateLimit.js';

export const authRouter = Router();

export const RegisterSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
  role: z.enum(['admin', 'qa_engineer', 'viewer']).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
});

const loginLimiter = createRateLimiter({ windowMs: 60_000, max: 10, keyFn: ipKey });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 5, keyFn: ipKey });

function extractIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

authRouter.post(
  '/auth/register',
  registerLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => i.message).join('; ');
      return next(new HttpError(400, `Invalid registration: ${detail}`));
    }
    const callerIsAdmin = req.user?.role === 'admin';
    if (!env.AUTH_ALLOW_REGISTRATION && !callerIsAdmin) {
      return next(new HttpError(403, 'Registration disabled', 'forbidden'));
    }
    const strength = validatePasswordStrength(parsed.data.password);
    if (!strength.ok) return next(new HttpError(400, `Weak password: ${strength.reason}`));

    let role: UserRole;
    if (callerIsAdmin && parsed.data.role) role = parsed.data.role;
    else role = env.AUTH_DEFAULT_ROLE;

    try {
      const existing = await findUserByEmail(pool, parsed.data.email);
      if (existing) return next(new HttpError(409, 'Email already registered', 'email_exists'));
      const passwordHash = await hashPassword(parsed.data.password);
      const user = await createUser(pool, { email: parsed.data.email, passwordHash, role });
      res.status(201).json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
      // Handle unique constraint race.
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        return next(new HttpError(409, 'Email already registered', 'email_exists'));
      }
      next(err);
    }
  },
);

authRouter.post(
  '/auth/login',
  loginLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return next(new HttpError(400, 'Invalid login body'));
    const emailLower = parsed.data.email.toLowerCase();
    const ip = extractIp(req);
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    try {
      const byEmail = await countRecent(pool, { emailLower, sinceIso: since, failuresOnly: true });
      const byIp = ip ? await countRecent(pool, { ip, sinceIso: since, failuresOnly: true }) : 0;
      if (byEmail >= 5 || byIp >= 5) {
        res.setHeader('Retry-After', '900');
        return next(new HttpError(429, 'Too many failed attempts', 'rate_limited'));
      }
      const user = await findUserByEmail(pool, parsed.data.email);
      const ok =
        user && user.password_hash
          ? await verifyPassword(parsed.data.password, user.password_hash)
          : false;
      if (!user || !ok) {
        await recordAttempt(pool, { emailLower, ip, success: false });
        return next(new HttpError(401, 'Invalid credentials', 'invalid_credentials'));
      }
      await recordAttempt(pool, { emailLower, ip, success: true });
      const session = await createSession(pool, user.id, req);
      setSessionCookie(res, session.token);
      await updateLastLogin(pool, user.id);
      res.json({ user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  '/auth/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = readSessionCookie(req);
      if (token) await revokeSession(pool, token);
      clearSessionCookie(res);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

const GoogleLoginSchema = z.object({
  idToken: z.string().min(10).max(8192),
});

authRouter.post(
  '/auth/google',
  loginLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!isFirebaseAuthEnabled()) {
      return next(new HttpError(404, 'Google auth not enabled', 'google_disabled'));
    }
    const parsed = GoogleLoginSchema.safeParse(req.body);
    if (!parsed.success) return next(new HttpError(400, 'Invalid body'));
    try {
      const decoded = await verifyFirebaseIdToken(parsed.data.idToken);
      const email = decoded.email?.toLowerCase();
      if (!email || !decoded.email_verified) {
        return next(new HttpError(401, 'Verified email required', 'email_unverified'));
      }
      const firebaseUid = decoded.uid;
      const avatarUrl = (decoded.picture as string | undefined) ?? null;
      const displayName = (decoded.name as string | undefined) ?? null;

      let user =
        (await findUserByFirebaseUid(pool, firebaseUid)) ??
        (await findUserByEmail(pool, email));

      if (user && !user.firebase_uid) {
        await linkFirebaseUid(pool, user.id, firebaseUid, avatarUrl, displayName);
      }

      if (!user) {
        if (!env.AUTH_ALLOW_REGISTRATION) {
          return next(new HttpError(403, 'Registration disabled', 'forbidden'));
        }
        user = await createUser(pool, {
          email,
          passwordHash: null,
          role: env.AUTH_DEFAULT_ROLE,
          firebaseUid,
          avatarUrl,
          displayName,
        });
      }

      await recordAttempt(pool, { emailLower: email, ip: extractIp(req), success: true });
      const session = await createSession(pool, user.id, req);
      setSessionCookie(res, session.token);
      await updateLastLogin(pool, user.id);
      res.json({ user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/id-token-expired' || code === 'auth/argument-error') {
        return next(new HttpError(401, 'Invalid ID token', 'invalid_id_token'));
      }
      next(err);
    }
  },
);

authRouter.get('/auth/me', requireUser, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

authRouter.get('/auth/public-config', (_req: Request, res: Response) => {
  if (!isFirebaseAuthEnabled()) {
    res.json({ googleAuthEnabled: false });
    return;
  }
  res.json({
    googleAuthEnabled: true,
    firebase: {
      apiKey: env.FIREBASE_WEB_API_KEY,
      appId: env.FIREBASE_WEB_APP_ID,
      authDomain: env.FIREBASE_AUTH_DOMAIN || `${env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: env.FIREBASE_PROJECT_ID,
    },
  });
});
