import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { authenticateCiToken } from '../middleware/authenticateCiToken.js';
import { createRateLimiter, ciTokenKey } from '../middleware/rateLimit.js';
import { LocalArtifactStore } from '../artifacts/localArtifactStore.js';
import { TestRunPersistenceService } from '../services/testRunPersistenceService.js';
import { RegressionCampaignService } from '../ai/regression/regressionCampaignService.js';
import { getConfiguredProvider } from '../ai/providerFactory.js';
import { LLMProviderError } from '../ai/providers/llmProvider.js';
import {
  getCampaignById,
  listCampaignTests,
} from '../db/repositories/regressionCampaignRepo.js';

export const ciRouter = Router();

const CampaignSchema = z.object({
  applicationId: z.string().uuid().nullable().optional(),
  strategy: z.enum(['all_enabled', 'risk_based', 'changed_area', 'bug_targeted', 'smoke']),
  maxTests: z.number().int().positive().max(500).optional(),
  waitForCompletion: z.boolean().optional(),
});

const UuidParam = z.string().uuid();

const ciLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 30, keyFn: ciTokenKey });

function buildService(): RegressionCampaignService {
  const artifactStore = new LocalArtifactStore(env.ARTIFACT_STORAGE_PATH);
  const persistence = new TestRunPersistenceService(pool, artifactStore);
  let provider = null;
  try {
    provider = getConfiguredProvider();
  } catch (err) {
    if (!(err instanceof LLMProviderError && err.kind === 'missing_api_key')) throw err;
  }
  return new RegressionCampaignService({
    pool,
    persistence,
    maxConcurrency: env.REGRESSION_MAX_CONCURRENCY,
    maxAutoInvestigations: env.MAX_AUTO_INVESTIGATIONS_PER_CAMPAIGN,
    provider,
  });
}

function exitCodeFor(quality: string | null | undefined): number {
  switch (quality) {
    case 'healthy':
      return 0;
    case 'degraded':
      return env.CI_DEGRADED_EXIT_CODE;
    case 'failed':
      return 1;
    case 'inconclusive':
      return 2;
    default:
      return 2;
  }
}

ciRouter.post(
  '/ci/regression',
  authenticateCiToken,
  ciLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = CampaignSchema.safeParse(req.body);
    if (!parsed.success) return next(new HttpError(400, 'Invalid CI regression request'));
    // Scope enforcement: token bound to app must match request's app.
    if (
      req.ciToken?.applicationId &&
      parsed.data.applicationId &&
      req.ciToken.applicationId !== parsed.data.applicationId
    ) {
      return next(new HttpError(403, 'Token not authorized for application', 'forbidden'));
    }
    const applicationId = parsed.data.applicationId ?? req.ciToken?.applicationId ?? null;

    try {
      const svc = buildService();
      const preview = await svc.createCampaign({
        applicationId,
        strategy: parsed.data.strategy,
        trigger: 'ci',
        ...(parsed.data.maxTests !== undefined ? { maxTests: parsed.data.maxTests } : {}),
      });
      const campaignId = preview.campaign.id;
      const runPromise = svc.runCampaign(campaignId).catch((err) => {
        console.error('[ci:regression] runCampaign failed', {
          campaignId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      if (parsed.data.waitForCompletion) {
        const deadline = Date.now() + 60_000;
        // Ensure the run promise resolves or timeout hits.
        while (Date.now() < deadline) {
          const camp = await getCampaignById(pool, campaignId);
          if (camp && (camp.status === 'passed' || camp.status === 'failed' || camp.status === 'error' || camp.status === 'cancelled')) {
            return res.status(200).json({
              campaignId,
              status: camp.status,
              quality: camp.quality,
              passed: camp.passed_runs,
              failed: camp.failed_runs,
              errors: camp.error_runs,
              exitCode: exitCodeFor(camp.quality),
            });
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        void runPromise;
        return res.status(202).json({
          campaignId,
          status: 'running',
          selectedTestCount: preview.selected.length,
          message: 'waitForCompletion timed out; poll GET /api/ci/regression/:id/result',
        });
      }

      void runPromise;
      return res.status(202).json({
        campaignId,
        status: 'queued',
        selectedTestCount: preview.selected.length,
      });
    } catch (err) {
      next(new HttpError(400, err instanceof Error ? err.message : 'unknown error'));
    }
  },
);

ciRouter.get(
  '/ci/regression/:campaignId/result',
  authenticateCiToken,
  async (req: Request, res: Response, next: NextFunction) => {
    const id = UuidParam.safeParse(req.params.campaignId);
    if (!id.success) return next(new HttpError(400, 'Invalid campaign id'));
    try {
      const camp = await getCampaignById(pool, id.data);
      if (!camp) return next(new HttpError(404, 'Campaign not found'));
      if (
        req.ciToken?.applicationId &&
        camp.application_id &&
        req.ciToken.applicationId !== camp.application_id
      ) {
        return next(new HttpError(403, 'Token not authorized for this campaign', 'forbidden'));
      }
      const members = await listCampaignTests(pool, id.data);
      // regressions/flakyTests: computed from campaign quality only for now;
      // a richer implementation would join bug_clusters/reliability against this campaign's runs.
      res.json({
        campaignId: camp.id,
        status: camp.status,
        quality: camp.quality,
        passed: camp.passed_runs,
        failed: camp.failed_runs,
        errors: camp.error_runs,
        regressions: 0,
        flakyTests: 0,
        totalTests: members.length,
        exitCode: exitCodeFor(camp.quality),
      });
    } catch (err) {
      next(err);
    }
  },
);
