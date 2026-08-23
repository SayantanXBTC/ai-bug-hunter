import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { DiscoveryEngine, assertSafeUrl } from '@ai-bug-hunter/test-engine';
import { HttpError } from '../middleware/errorHandler.js';

export const discoveryRouter = Router();

const DiscoverySchema = z
  .object({
    baseUrl: z.string().min(1).max(2048),
    maxPages: z.number().int().positive().max(100).optional(),
    maxDepth: z.number().int().min(0).max(10).optional(),
    sameOriginOnly: z.boolean().optional(),
    allowedHosts: z.array(z.string().min(1).max(255)).max(20).optional(),
    navigationTimeoutMs: z.number().int().positive().max(60_000).optional(),
    actionTimeoutMs: z.number().int().positive().max(60_000).optional(),
    pageSettleMs: z.number().int().nonnegative().max(5_000).optional(),
    maxElementsPerPage: z.number().int().positive().max(1000).optional(),
    accessibilityMaxNodes: z.number().int().positive().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    try {
      assertSafeUrl(v.baseUrl);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseUrl'],
        message: err instanceof Error ? err.message : 'Invalid URL',
      });
    }
  });

discoveryRouter.post(
  '/discovery',
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = DiscoverySchema.safeParse(req.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return next(new HttpError(400, `Invalid discovery request: ${detail}`));
    }
    try {
      const engine = new DiscoveryEngine();
      const result = await engine.discover(parsed.data);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
