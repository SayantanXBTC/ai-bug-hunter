import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { getTestRunById, listHistoricalRuns, listStepsForRun } from '../db/repositories/testRunRepo.js';
import { getArtifactById, listEvidenceForRun, type ArtifactRecord } from '../db/repositories/evidenceRepo.js';
import { LocalArtifactStore } from '../artifacts/localArtifactStore.js';
import { FailureInvestigator } from '../ai/investigation/failureInvestigator.js';
import { getConfiguredProvider } from '../ai/providerFactory.js';
import { LLMProviderError, type ImageEvidenceInput } from '../ai/providers/llmProvider.js';
import { sanitizeDom } from '../ai/investigation/investigationContext.js';
import {
  getInvestigationByTestRunId,
  upsertInvestigation,
} from '../db/repositories/investigationRepo.js';
import { requireRole, requireUser } from '../middleware/authenticate.js';

export const investigationRouter = Router();

const artifactStore = new LocalArtifactStore(env.ARTIFACT_STORAGE_PATH);
const UuidParam = z.string().uuid();
const ForceQuery = z.object({ force: z.enum(['true', 'false']).optional() });

investigationRouter.get(
  '/ai/investigate/:testRunId',
  requireUser,
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = UuidParam.safeParse(req.params.testRunId);
    if (!parsed.success) return next(new HttpError(400, 'Invalid test run id'));
    try {
      const record = await getInvestigationByTestRunId(pool, parsed.data);
      if (!record) return next(new HttpError(404, 'No investigation exists for this test run'));
      res.json({ status: 'ok', report: record.report_json });
    } catch (err) {
      next(err);
    }
  },
);

investigationRouter.post(
  '/ai/investigate/:testRunId',
  requireRole('qa_engineer'),
  async (req: Request, res: Response, next: NextFunction) => {
    const idCheck = UuidParam.safeParse(req.params.testRunId);
    if (!idCheck.success) return next(new HttpError(400, 'Invalid test run id'));
    const qCheck = ForceQuery.safeParse(req.query);
    if (!qCheck.success) return next(new HttpError(400, 'Invalid query'));
    const force = qCheck.data.force === 'true';

    try {
      const testRunId = idCheck.data;

      if (!force) {
        const existing = await getInvestigationByTestRunId(pool, testRunId);
        if (existing) {
          return res.json({ status: 'ok', report: existing.report_json, cached: true });
        }
      }

      const run = await getTestRunById(pool, testRunId);
      if (!run) return next(new HttpError(404, 'Test run not found'));
      if (run.status === 'passed') {
        return res.json({
          status: 'not_investigable',
          message: 'Investigation is available for failed or errored runs.',
        });
      }

      const [steps, evidence] = await Promise.all([
        listStepsForRun(pool, run.id),
        listEvidenceForRun(pool, run.id),
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

      let provider;
      try {
        provider = getConfiguredProvider();
      } catch (err) {
        if (err instanceof LLMProviderError && err.kind === 'missing_api_key') {
          return res.json({
            status: 'provider_error',
            message: 'AI investigation is not configured on the server.',
          });
        }
        return next(err);
      }

      // Screenshot artifact.
      let screenshot: ImageEvidenceInput | undefined;
      const screenshotEvidence = evidence.find((e) => e.evidence_type === 'screenshot');
      if (screenshotEvidence?.artifact_id) {
        const artifact = artifactsById.get(screenshotEvidence.artifact_id);
        if (artifact && artifact.content_type === 'image/png') {
          try {
            const buf = await artifactStore.read(artifact.storage_key);
            screenshot = { mediaType: 'image/png', data: buf.toString('base64') };
          } catch {
            /* skip on error */
          }
        }
      }

      // DOM artifact.
      let domText: string | undefined;
      const domEvidence = evidence.find((e) => e.evidence_type === 'dom');
      if (domEvidence?.artifact_id) {
        const artifact = artifactsById.get(domEvidence.artifact_id);
        if (artifact) {
          try {
            const buf = await artifactStore.read(artifact.storage_key);
            domText = sanitizeDom(buf.toString('utf8'), 20_000);
          } catch {
            /* skip */
          }
        }
      }

      const historicalRuns = await listHistoricalRuns(pool, run.external_test_id, run.id, 10);

      const investigator = new FailureInvestigator({
        provider,
        model: env.LLM_MODEL,
      });
      const result = await investigator.investigate({
        run,
        steps,
        evidence,
        artifactsById,
        historicalRuns,
        ...(domText ? { domText } : {}),
        ...(screenshot ? { screenshot } : {}),
      });

      if (result.status === 'ok' && result.report) {
        await upsertInvestigation(pool, result.report);
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
