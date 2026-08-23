import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { LocalArtifactStore } from '../artifacts/localArtifactStore.js';
import { TestRunPersistenceService } from '../services/testRunPersistenceService.js';
import { RegressionCampaignService } from '../ai/regression/regressionCampaignService.js';
import {
  getCampaignById,
  listCampaignTests,
  listCampaigns,
} from '../db/repositories/regressionCampaignRepo.js';
import { getTestCaseById } from '../db/repositories/testCaseRepo.js';
import { BugIntelligenceService } from '../ai/intelligence/bugIntelligenceService.js';
import { getConfiguredProvider } from '../ai/providerFactory.js';
import { FailureInvestigator } from '../ai/investigation/failureInvestigator.js';
import { LLMProviderError } from '../ai/providers/llmProvider.js';
import {
  getInvestigationByTestRunId,
  upsertInvestigation,
} from '../db/repositories/investigationRepo.js';
import {
  getTestRunById,
  listHistoricalRuns,
  listStepsForRun,
} from '../db/repositories/testRunRepo.js';
import {
  getArtifactById,
  listEvidenceForRun,
  type ArtifactRecord,
} from '../db/repositories/evidenceRepo.js';
import { sanitizeDom } from '../ai/investigation/investigationContext.js';

export const regressionCampaignsRouter = Router();

const CreateSchema = z.object({
  applicationId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  strategy: z.enum(['all_enabled', 'risk_based', 'changed_area', 'bug_targeted', 'smoke']),
  maxTests: z.number().int().positive().max(500).optional(),
  trigger: z.enum(['manual', 'api', 'ci']).optional(),
});

const UuidParam = z.string().uuid();

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(['queued', 'running', 'passed', 'failed', 'cancelled', 'error'])
    .optional(),
  applicationId: z.string().uuid().optional(),
});

function buildService(): RegressionCampaignService {
  const artifactStore = new LocalArtifactStore(env.ARTIFACT_STORAGE_PATH);
  const persistence = new TestRunPersistenceService(pool, artifactStore);
  let provider = null;
  try {
    provider = getConfiguredProvider();
  } catch (err) {
    if (!(err instanceof LLMProviderError && err.kind === 'missing_api_key')) throw err;
  }

  const svc = new RegressionCampaignService({
    pool,
    persistence,
    maxConcurrency: env.REGRESSION_MAX_CONCURRENCY,
    maxAutoInvestigations: env.MAX_AUTO_INVESTIGATIONS_PER_CAMPAIGN,
    provider,
    investigateFailed: provider
      ? async (testRunId: string) => {
          const run = await getTestRunById(pool, testRunId);
          if (!run || run.status === 'passed') return;
          const existing = await getInvestigationByTestRunId(pool, testRunId);
          if (existing) return;
          const [steps, evidence] = await Promise.all([
            listStepsForRun(pool, testRunId),
            listEvidenceForRun(pool, testRunId),
          ]);
          const artifactsById = new Map<string, ArtifactRecord>();
          await Promise.all(
            evidence
              .filter((e) => e.artifact_id)
              .map(async (e) => {
                const a = await getArtifactById(pool, e.artifact_id!);
                if (a) artifactsById.set(a.id, a);
              }),
          );
          const history = await listHistoricalRuns(pool, run.external_test_id, run.id, 10);
          let domText: string | undefined;
          const dom = evidence.find((e) => e.evidence_type === 'dom' && e.artifact_id);
          if (dom?.artifact_id) {
            const a = artifactsById.get(dom.artifact_id);
            if (a) {
              try {
                const buf = await artifactStore.read(a.storage_key);
                domText = sanitizeDom(buf.toString('utf8'), 20_000);
              } catch {
                /* ignore */
              }
            }
          }
          const investigator = new FailureInvestigator({ provider: provider!, model: env.LLM_MODEL });
          const result = await investigator.investigate({
            run,
            steps,
            evidence,
            artifactsById,
            historicalRuns: history,
            ...(domText ? { domText } : {}),
          });
          if (result.status === 'ok' && result.report) {
            await upsertInvestigation(pool, result.report);
          }
        }
      : undefined,
    runBugIntelligence: async (testRunIds: string[]) => {
      const intel = new BugIntelligenceService({
        pool,
        provider,
        model: env.LLM_MODEL,
        maxRuns: env.BUG_INTEL_MAX_RUNS,
        maxCandidatePairs: env.BUG_INTEL_MAX_CANDIDATE_PAIRS,
        maxAiComparisons: env.BUG_INTEL_MAX_AI_COMPARISONS,
        minResolutionPassStreak: env.BUG_INTEL_MIN_RESOLUTION_STREAK,
      });
      await intel.analyze({ testRunIds });
    },
  });
  return svc;
}

regressionCampaignsRouter.post(
  '/regression-campaigns',
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return next(new HttpError(400, 'Invalid campaign request'));
    try {
      const svc = buildService();
      const preview = await svc.createCampaign({
        applicationId: parsed.data.applicationId ?? null,
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        strategy: parsed.data.strategy,
        ...(parsed.data.maxTests !== undefined ? { maxTests: parsed.data.maxTests } : {}),
        ...(parsed.data.trigger ? { trigger: parsed.data.trigger } : {}),
      });
      res.status(201).json({ campaign: preview.campaign, selected: preview.selected });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      next(new HttpError(400, message));
    }
  },
);

regressionCampaignsRouter.post(
  '/regression-campaigns/:id/run',
  async (req: Request, res: Response, next: NextFunction) => {
    const id = UuidParam.safeParse(req.params.id);
    if (!id.success) return next(new HttpError(400, 'Invalid id'));
    try {
      const svc = buildService();
      const row = await svc.runCampaign(id.data);
      res.json(row);
    } catch (err) {
      next(new HttpError(400, err instanceof Error ? err.message : 'unknown error'));
    }
  },
);

regressionCampaignsRouter.post(
  '/regression-campaigns/:id/cancel',
  async (req: Request, res: Response, next: NextFunction) => {
    const id = UuidParam.safeParse(req.params.id);
    if (!id.success) return next(new HttpError(400, 'Invalid id'));
    try {
      const svc = buildService();
      const row = await svc.cancelCampaign(id.data);
      if (!row) return next(new HttpError(404, 'Campaign not found'));
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

regressionCampaignsRouter.get(
  '/regression-campaigns',
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = ListSchema.safeParse(req.query);
    if (!parsed.success) return next(new HttpError(400, 'Invalid query'));
    try {
      const opts: Parameters<typeof listCampaigns>[1] = {
        page: parsed.data.page,
        limit: parsed.data.limit,
      };
      if (parsed.data.status) opts.status = parsed.data.status;
      if (parsed.data.applicationId) opts.applicationId = parsed.data.applicationId;
      const { items, total } = await listCampaigns(pool, opts);
      res.json({ items, page: parsed.data.page, limit: parsed.data.limit, total });
    } catch (err) {
      next(err);
    }
  },
);

regressionCampaignsRouter.get(
  '/regression-campaigns/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    const id = UuidParam.safeParse(req.params.id);
    if (!id.success) return next(new HttpError(400, 'Invalid id'));
    try {
      const campaign = await getCampaignById(pool, id.data);
      if (!campaign) return next(new HttpError(404, 'Campaign not found'));
      const members = await listCampaignTests(pool, id.data);
      const memberDetail = await Promise.all(
        members.map(async (m) => {
          const tc = await getTestCaseById(pool, m.test_case_id);
          return {
            testCaseId: m.test_case_id,
            testCaseName: tc?.name ?? 'unknown',
            priority: tc?.priority ?? 'medium',
            selectionScore: Number(m.selection_score),
            selectionReason: m.selection_reason,
            executionRunId: m.execution_run_id,
            status: m.status,
            startedAt: m.started_at?.toISOString() ?? null,
            finishedAt: m.finished_at?.toISOString() ?? null,
            ordinal: m.ordinal,
          };
        }),
      );
      res.json({ campaign, members: memberDetail });
    } catch (err) {
      next(err);
    }
  },
);
