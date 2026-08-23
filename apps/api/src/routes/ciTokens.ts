import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { requireRole } from '../middleware/authenticate.js';
import { generateOpaqueToken } from '../security/tokens.js';
import {
  createToken,
  getById,
  listActive,
  revokeById,
} from '../db/repositories/ciTokenRepo.js';

export const ciTokensRouter = Router();

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  applicationId: z.string().uuid().nullable().optional(),
});

const UuidParam = z.string().uuid();

ciTokensRouter.post(
  '/ci-tokens',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return next(new HttpError(400, 'Invalid CI token request'));
    try {
      const { token, hash } = generateOpaqueToken();
      const row = await createToken(pool, {
        name: parsed.data.name,
        applicationId: parsed.data.applicationId ?? null,
        tokenHash: hash,
        createdBy: req.user?.id ?? null,
      });
      res.status(201).json({
        id: row.id,
        name: row.name,
        applicationId: row.application_id,
        token,
        warning: 'This token is shown only once. Store it securely; it cannot be retrieved again.',
      });
    } catch (err) {
      next(err);
    }
  },
);

ciTokensRouter.get(
  '/ci-tokens',
  requireRole('admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await listActive(pool, {});
      res.json({
        items: rows.map((r) => ({
          id: r.id,
          name: r.name,
          applicationId: r.application_id,
          createdBy: r.created_by,
          createdAt: r.created_at,
          lastUsedAt: r.last_used_at,
          revokedAt: r.revoked_at,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

ciTokensRouter.post(
  '/ci-tokens/:id/revoke',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = UuidParam.safeParse(req.params.id);
    if (!id.success) return next(new HttpError(400, 'Invalid id'));
    try {
      const row = await revokeById(pool, id.data);
      if (!row) {
        const existing = await getById(pool, id.data);
        if (!existing) return next(new HttpError(404, 'CI token not found'));
        // Already revoked.
        return res.json({ id: existing.id, revokedAt: existing.revoked_at });
      }
      res.json({ id: row.id, revokedAt: row.revoked_at });
    } catch (err) {
      next(err);
    }
  },
);
