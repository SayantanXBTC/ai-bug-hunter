import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import {
  createUser,
  findUserByEmail,
  updateLastLogin,
  type UserRole,
} from '../db/repositories/userRepo.js';
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
      const ok = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
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

authRouter.get('/auth/me', requireUser, (req: Request, res: Response) => {
  res.json({ user: req.user });
});
