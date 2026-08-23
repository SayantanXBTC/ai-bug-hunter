import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { TestReliabilityService, reliabilityFromRow } from '../ai/reliability/reliabilityService.js';
import { getReliabilityByExternalId, listReliability } from '../db/repositories/testReliabilityRepo.js';

export const testReliabilityRouter = Router();

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['stable', 'suspected_flaky', 'flaky', 'unstable', 'insufficient_data']).optional(),
  flakyOnly: z.enum(['true', 'false']).optional(),
  minRuns: z.coerce.number().int().nonnegative().optional(),
});

testReliabilityRouter.post(
  '/ai/test-reliability/recalculate',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const svc = new TestReliabilityService({ pool, minRuns: env.MIN_FLAKY_RUNS });
      const summary = await svc.recalculateAll();
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);

testReliabilityRouter.get(
  '/ai/test-reliability',
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = ListSchema.safeParse(req.query);
    if (!parsed.success) return next(new HttpError(400, 'Invalid query'));
    try {
      const opts: Parameters<typeof listReliability>[1] = {
        page: parsed.data.page,
        limit: parsed.data.limit,
      };
      if (parsed.data.status) opts.status = parsed.data.status;
      if (parsed.data.flakyOnly === 'true') opts.flakyOnly = true;
      if (parsed.data.minRuns !== undefined) opts.minRuns = parsed.data.minRuns;
      const { items, total } = await listReliability(pool, opts);
      res.json({
        items: items.map((r) => reliabilityFromRow(r)),
        page: parsed.data.page,
        limit: parsed.data.limit,
        total,
      });
    } catch (err) {
      next(err);
    }
  },
);

testReliabilityRouter.get(
  '/ai/test-reliability/:externalTestId',
  async (req: Request, res: Response, next: NextFunction) => {
    const id = String(req.params.externalTestId ?? '');
    if (!id || id.length > 200) return next(new HttpError(400, 'Invalid id'));
    try {
      const row = await getReliabilityByExternalId(pool, id);
      if (!row) return next(new HttpError(404, 'Reliability not found'));
      res.json(reliabilityFromRow(row));
    } catch (err) {
      next(err);
    }
  },
);
