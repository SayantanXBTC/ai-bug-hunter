import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { insertApplication, listApplications } from '../db/repositories/applicationRepo.js';
import { env } from '../config/env.js';
import { requireRole, requireUser } from '../middleware/authenticate.js';

export const applicationsRouter = Router();

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  baseUrl: z.string().url().refine((v) => /^https?:$/.test(new URL(v).protocol), {
    message: 'baseUrl must be http or https',
  }),
  description: z.string().max(2000).optional(),
});

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(env.TEST_RUNS_LIST_MAX_LIMIT).default(20),
});

applicationsRouter.post(
  '/applications',
  requireRole('qa_engineer'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => i.message).join('; ');
      return next(new HttpError(400, `Invalid application: ${detail}`));
    }
    try {
      const app = await insertApplication(pool, parsed.data);
      res.status(201).json(app);
    } catch (err) {
      next(err);
    }
  },
);

applicationsRouter.get(
  '/applications',
  requireUser,
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) return next(new HttpError(400, 'Invalid pagination'));
    try {
      const { items, total } = await listApplications(pool, parsed.data.page, parsed.data.limit);
      res.json({ items, page: parsed.data.page, limit: parsed.data.limit, total });
    } catch (err) {
      next(err);
    }
  },
);
