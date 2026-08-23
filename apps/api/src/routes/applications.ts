import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import {
  countChildrenForApplication,
  deleteApplicationById,
  getApplicationById,
  insertApplication,
  listApplications,
  type Scope,
} from '../db/repositories/applicationRepo.js';
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

function scopeOf(req: Request): Scope | undefined {
  if (!req.user) return undefined;
  return { ownerId: req.user.id, isAdmin: req.user.role === 'admin' };
}

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
      const app = await insertApplication(pool, {
        ...parsed.data,
        ownerId: req.user?.id ?? null,
      });
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
      const { items, total } = await listApplications(
        pool,
        parsed.data.page,
        parsed.data.limit,
        scopeOf(req),
      );
      res.json({ items, page: parsed.data.page, limit: parsed.data.limit, total });
    } catch (err) {
      next(err);
    }
  },
);

const UuidParam = z.string().uuid();

applicationsRouter.get(
  '/applications/:id',
  requireUser,
  async (req: Request, res: Response, next: NextFunction) => {
    const id = UuidParam.safeParse(req.params.id);
    if (!id.success) return next(new HttpError(400, 'Invalid id'));
    try {
      const row = await getApplicationById(pool, id.data, scopeOf(req));
      if (!row) return next(new HttpError(404, 'Application not found'));
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

applicationsRouter.delete(
  '/applications/:id',
  requireRole('qa_engineer'),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = UuidParam.safeParse(req.params.id);
    if (!id.success) return next(new HttpError(400, 'Invalid id'));
    try {
      // Ownership check (returns null for cross-tenant → 404 to avoid enumeration).
      const existing = await getApplicationById(pool, id.data, scopeOf(req));
      if (!existing) return next(new HttpError(404, 'Application not found'));
      // Block delete if children exist (safety over cascade).
      const counts = await countChildrenForApplication(pool, id.data);
      if (counts.testCases > 0 || counts.testRuns > 0) {
        return next(
          new HttpError(
            409,
            `Application has ${counts.testCases} test case(s) and ${counts.testRuns} test run(s). Delete them first.`,
            'application_has_children',
          ),
        );
      }
      const ok = await deleteApplicationById(pool, id.data, scopeOf(req));
      if (!ok) return next(new HttpError(404, 'Application not found'));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
