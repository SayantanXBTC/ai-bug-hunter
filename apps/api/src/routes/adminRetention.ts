import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { requireRole } from '../middleware/authenticate.js';
import { applyRetention, previewRetention } from '../services/retentionService.js';

export const adminRetentionRouter = Router();

const PreviewSchema = z.object({
  olderThanDays: z.number().int().min(1).max(3650),
  includeArtifacts: z.boolean(),
});
const ApplySchema = PreviewSchema.extend({ confirm: z.boolean() });

function ensureEnabled(next: NextFunction): boolean {
  if (!env.RETENTION_ENABLED) {
    next(new HttpError(403, 'Retention is disabled', 'retention_disabled'));
    return false;
  }
  return true;
}

adminRetentionRouter.post(
  '/admin/retention/preview',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!ensureEnabled(next)) return;
    const parsed = PreviewSchema.safeParse(req.body);
    if (!parsed.success) return next(new HttpError(400, 'Invalid retention request'));
    try {
      const counts = await previewRetention(pool, parsed.data);
      res.json({ preview: true, counts });
    } catch (err) {
      next(err);
    }
  },
);

adminRetentionRouter.post(
  '/admin/retention/apply',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!ensureEnabled(next)) return;
    const parsed = ApplySchema.safeParse(req.body);
    if (!parsed.success) return next(new HttpError(400, 'Invalid retention request'));
    if (!parsed.data.confirm) {
      return next(new HttpError(400, 'confirm=true is required to apply retention', 'confirm_required'));
    }
    try {
      const counts = await applyRetention(pool, parsed.data);
      res.json({ applied: true, counts });
    } catch (err) {
      next(err);
    }
  },
);
