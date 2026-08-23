import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { readSessionCookie, verifySession } from '../security/session.js';
import { HttpError } from './errorHandler.js';
import type { UserRole } from '../db/repositories/userRepo.js';

const ROLE_ORDER: Record<UserRole, number> = { viewer: 0, qa_engineer: 1, admin: 2 };

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    // Test bypass: only in test env + explicit env flag.
    if (env.NODE_ENV === 'test' && env.TEST_AUTH_BYPASS === '1') {
      const role = (req.headers['x-test-user-role'] as string | undefined) ?? 'admin';
      const validRole: UserRole =
        role === 'admin' || role === 'qa_engineer' || role === 'viewer' ? role : 'admin';
      const idHeader = req.headers['x-test-user-id'];
      const emailHeader = req.headers['x-test-user-email'];
      req.user = {
        id: typeof idHeader === 'string' ? idHeader : '00000000-0000-0000-0000-000000000001',
        email: typeof emailHeader === 'string' ? emailHeader : 'test@example.com',
        role: validRole,
      };
      return next();
    }
    const token = readSessionCookie(req);
    if (!token) return next();
    const user = await verifySession(pool, token);
    if (user) {
      req.user = { id: user.id, email: user.email, role: user.role };
    }
    next();
  } catch (err) {
    next(err);
  }
};

export function requireUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new HttpError(401, 'Authentication required', 'unauthenticated'));
  next();
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required', 'unauthenticated'));
    if (req.user.role === 'admin') return next();
    if (roles.some((r) => ROLE_ORDER[req.user!.role] >= ROLE_ORDER[r])) return next();
    return next(new HttpError(403, 'Insufficient role', 'forbidden'));
  };
}
