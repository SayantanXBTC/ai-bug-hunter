import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { BugIntelligenceService } from '../ai/intelligence/bugIntelligenceService.js';
import { getConfiguredProvider } from '../ai/providerFactory.js';
import { LLMProviderError } from '../ai/providers/llmProvider.js';
import {
  getClusterById,
  listClusters,
  listMembersForCluster,
  mapClusterRow,
  mapMemberRow,
} from '../db/repositories/bugClusterRepo.js';
import { getTestRunById } from '../db/repositories/testRunRepo.js';

export const bugIntelligenceRouter = Router();

const AnalyzeSchema = z.object({
  since: z.string().datetime().optional(),
  testRunIds: z.array(z.string().uuid()).max(500).optional(),
});

bugIntelligenceRouter.post(
  '/ai/bug-intelligence/analyze',
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = AnalyzeSchema.safeParse(req.body ?? {});
    if (!parsed.success) return next(new HttpError(400, 'Invalid analyze request'));

    let provider = null;
    try {
      provider = getConfiguredProvider();
    } catch (err) {
      if (!(err instanceof LLMProviderError && err.kind === 'missing_api_key')) {
        return next(err);
      }
      // Continue with deterministic-only clustering if no key.
    }

    try {
      const service = new BugIntelligenceService({
        pool,
        provider,
        model: env.LLM_MODEL,
        maxRuns: env.BUG_INTEL_MAX_RUNS,
        maxCandidatePairs: env.BUG_INTEL_MAX_CANDIDATE_PAIRS,
        maxAiComparisons: env.BUG_INTEL_MAX_AI_COMPARISONS,
        minResolutionPassStreak: env.BUG_INTEL_MIN_RESOLUTION_STREAK,
      });
      const input: { since?: Date; testRunIds?: string[] } = {};
      if (parsed.data.since) input.since = new Date(parsed.data.since);
      if (parsed.data.testRunIds) input.testRunIds = parsed.data.testRunIds;
      const summary = await service.analyze(input);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(['open', 'recurring', 'regressed', 'resolved', 'inconclusive'])
    .optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'none', 'unknown']).optional(),
  regressionStatus: z
    .enum(['first_seen', 'recurring', 'regressed', 'resolved', 'inconclusive'])
    .optional(),
});

bugIntelligenceRouter.get(
  '/ai/bug-intelligence/clusters',
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = ListSchema.safeParse(req.query);
    if (!parsed.success) return next(new HttpError(400, 'Invalid list request'));
    try {
      const { items, total } = await listClusters(pool, {
        page: parsed.data.page,
        limit: parsed.data.limit,
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.severity ? { severity: parsed.data.severity } : {}),
        ...(parsed.data.regressionStatus ? { regressionStatus: parsed.data.regressionStatus } : {}),
      });
      res.json({
        items: items.map(mapClusterRow),
        page: parsed.data.page,
        limit: parsed.data.limit,
        total,
      });
    } catch (err) {
      next(err);
    }
  },
);

const UuidParam = z.string().uuid();

bugIntelligenceRouter.get(
  '/ai/bug-intelligence/clusters/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    const idCheck = UuidParam.safeParse(req.params.id);
    if (!idCheck.success) return next(new HttpError(400, 'Invalid cluster id'));
    try {
      const cluster = await getClusterById(pool, idCheck.data);
      if (!cluster) return next(new HttpError(404, 'Cluster not found'));
      const members = await listMembersForCluster(pool, cluster.id);
      const memberViews = await Promise.all(
        members.map(async (m) => {
          const run = await getTestRunById(pool, m.test_run_id);
          return {
            ...mapMemberRow(m),
            run: run
              ? {
                  id: run.id,
                  externalTestId: run.external_test_id,
                  testName: run.test_name,
                  status: run.status,
                  startedAt: run.started_at.toISOString(),
                  durationMs: run.duration_ms,
                }
              : null,
          };
        }),
      );
      const timeline = memberViews
        .filter((mv) => mv.run !== null)
        .map((mv, i) => ({
          at: mv.run!.startedAt,
          testRunId: mv.run!.id,
          externalTestId: mv.run!.externalTestId,
          status: mv.run!.status,
          kind: i === 0 ? 'first_seen' : 'recurrence',
        }))
        .sort((a, b) => (a.at < b.at ? -1 : 1));
      res.json({
        cluster: mapClusterRow(cluster),
        members: memberViews,
        timeline,
      });
    } catch (err) {
      next(err);
    }
  },
);
