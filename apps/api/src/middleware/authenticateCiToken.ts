import type { RequestHandler } from 'express';
import { pool } from '../db/pool.js';
import { hashToken } from '../security/tokens.js';
import { findByTokenHash, updateLastUsed } from '../db/repositories/ciTokenRepo.js';
import { HttpError } from './errorHandler.js';

export const authenticateCiToken: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(new HttpError(401, 'Bearer token required', 'unauthenticated'));
    }
    const raw = header.slice('Bearer '.length).trim();
    if (!raw) return next(new HttpError(401, 'Bearer token required', 'unauthenticated'));
    const hash = hashToken(raw);
    const row = await findByTokenHash(pool, hash);
    if (!row) return next(new HttpError(401, 'Invalid CI token', 'invalid_ci_token'));
    if (row.revoked_at) return next(new HttpError(401, 'Revoked CI token', 'invalid_ci_token'));
    req.ciToken = { id: row.id, applicationId: row.application_id };
    // Fire-and-forget last_used update.
    updateLastUsed(pool, row.id).catch(() => {
      /* ignore */
    });
    next();
  } catch (err) {
    next(err);
  }
};
