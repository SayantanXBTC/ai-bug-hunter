import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { TestDefinitionSchema, TestExecutor } from '@ai-bug-hunter/test-engine';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { LocalArtifactStore } from '../artifacts/localArtifactStore.js';
import { env } from '../config/env.js';
import { TestRunPersistenceService } from '../services/testRunPersistenceService.js';
import {
  getTestRunById,
  listStepsForRun,
  listTestRuns,
} from '../db/repositories/testRunRepo.js';
import { listEvidenceForRun } from '../db/repositories/evidenceRepo.js';
import { getArtifactById } from '../db/repositories/evidenceRepo.js';
import { requireRole, requireUser } from '../middleware/authenticate.js';

export const testRunsRouter = Router();

const artifactStore = new LocalArtifactStore(env.ARTIFACT_STORAGE_PATH);
const persistence = new TestRunPersistenceService(pool, artifactStore);

const CreateSchema = TestDefinitionSchema.and(
  z.object({
    testCaseId: z.string().uuid().optional(),
    includeEvidenceOnSuccess: z.boolean().optional(),
  }),
);

testRunsRouter.post(
  '/test-runs',
  requireRole('qa_engineer'),
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return next(new HttpError(400, `Invalid test definition: ${detail}`));
    }

    try {
      const executor = new TestExecutor({
        evidence: { includeEvidenceOnSuccess: parsed.data.includeEvidenceOnSuccess ?? false },
      });
      const execResult = await executor.run(parsed.data);
      const persisted = await persistence.persist(execResult, {
        testCaseId: parsed.data.testCaseId ?? null,
      });

      res.status(200).json(shapeRunDetail(persisted.run, persisted.steps, persisted.evidence));
    } catch (err) {
      next(err);
    }
  },
);

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(env.TEST_RUNS_LIST_MAX_LIMIT).default(20),
});

testRunsRouter.get(
  '/test-runs',
  requireUser,
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      return next(new HttpError(400, 'Invalid pagination'));
    }
    try {
      const { items, total } = await listTestRuns(pool, parsed.data.page, parsed.data.limit);
      res.json({
        items: items.map(shapeRunSummary),
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

testRunsRouter.get(
  '/test-runs/:id',
  requireUser,
  async (req: Request, res: Response, next: NextFunction) => {
    const idCheck = UuidParam.safeParse(req.params.id);
    if (!idCheck.success) return next(new HttpError(400, 'Invalid id'));
    try {
      const run = await getTestRunById(pool, idCheck.data);
      if (!run) return next(new HttpError(404, 'Test run not found'));
      const [steps, evidence] = await Promise.all([
        listStepsForRun(pool, run.id),
        listEvidenceForRun(pool, run.id),
      ]);
      const withArtifacts = await Promise.all(
        evidence.map(async (e) => {
          if (!e.artifact_id) return { record: e, artifact: null };
          const a = await getArtifactById(pool, e.artifact_id);
          return { record: e, artifact: a };
        }),
      );
      res.json(
        shapeRunDetail(
          run,
          steps,
          evidence,
          withArtifacts.map((w) => ({ evidenceId: w.record.id, artifact: w.artifact })),
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

// ---------- shaping helpers ----------

type Run = Awaited<ReturnType<typeof getTestRunById>>;
type Step = Awaited<ReturnType<typeof listStepsForRun>>[number];
type Evidence = Awaited<ReturnType<typeof listEvidenceForRun>>[number];
type ArtifactInfo = { evidenceId: string; artifact: Awaited<ReturnType<typeof getArtifactById>> };

function shapeRunSummary(r: NonNullable<Run>): Record<string, unknown> {
  return {
    id: r.id,
    testId: r.external_test_id,
    testName: r.test_name,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  };
}

function shapeRunDetail(
  r: NonNullable<Run>,
  steps: Step[],
  evidence: Evidence[],
  artifactInfos: ArtifactInfo[] = [],
): Record<string, unknown> {
  const artifactByEvidence = new Map(artifactInfos.map((a) => [a.evidenceId, a.artifact] as const));
  return {
    id: r.id,
    testId: r.external_test_id,
    testName: r.test_name,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
    error:
      r.error_name || r.error_message
        ? {
            name: r.error_name,
            message: r.error_message,
            stepIndex: r.error_step_index,
          }
        : undefined,
    steps: steps.map((s) => ({
      index: s.step_index,
      action: s.action,
      status: s.status,
      durationMs: s.duration_ms,
      error:
        s.error_name || s.error_message
          ? { name: s.error_name, message: s.error_message }
          : undefined,
    })),
    evidence: evidence.map((e) => {
      const artifact = artifactByEvidence.get(e.id) ?? null;
      const base = {
        id: e.id,
        type: e.evidence_type,
        stepId: e.test_run_step_id,
        metadata: e.metadata,
      };
      if (e.artifact_id) {
        return {
          ...base,
          artifactId: e.artifact_id,
          contentType: artifact?.content_type,
          byteSize: artifact ? Number(artifact.byte_size) : undefined,
          sha256: artifact?.sha256,
          downloadUrl: `/api/evidence/${e.id}`,
        };
      }
      return base;
    }),
  };
}
