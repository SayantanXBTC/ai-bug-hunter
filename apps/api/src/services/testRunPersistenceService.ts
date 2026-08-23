import type { Pool } from 'pg';
import type { EvidencePackage, ExecutionResult } from '@ai-bug-hunter/test-engine';
import type { ArtifactStore } from '../artifacts/artifactStore.js';
import {
  insertArtifact,
  insertEvidence,
  type EvidenceRecord,
  type EvidenceType,
} from '../db/repositories/evidenceRepo.js';
import {
  insertTestRun,
  insertTestRunStep,
  type TestRunRecord,
  type TestRunStepRecord,
} from '../db/repositories/testRunRepo.js';
import { logger } from '@ai-bug-hunter/test-engine';

export interface PersistedTestRun {
  run: TestRunRecord;
  steps: TestRunStepRecord[];
  evidence: EvidenceRecord[];
}

export class TestRunPersistenceService {
  constructor(
    private readonly pool: Pool,
    private readonly artifacts: ArtifactStore,
  ) {}

  async persist(
    result: ExecutionResult,
    opts: { testCaseId?: string | null; ownerId?: string | null } = {},
  ): Promise<PersistedTestRun> {
    // Phase 1: write artifacts to disk (non-transactional).
    const artifactRefs = await this.writeArtifacts(result.evidence);
    const orphanKeys = artifactRefs.map((a) => a.storageKey);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const run = await insertTestRun(client, {
        testCaseId: opts.testCaseId ?? null,
        ownerId: opts.ownerId ?? null,
        externalTestId: result.testId,
        testName: result.testName,
        status: result.status,
        startedAt: new Date(result.startedAt),
        finishedAt: new Date(result.finishedAt),
        durationMs: result.durationMs,
        ...(result.error
          ? {
              error: {
                name: result.error.name,
                message: result.error.message,
                ...(result.error.stepIndex !== undefined
                  ? { stepIndex: result.error.stepIndex }
                  : {}),
              },
            }
          : {}),
      });

      const steps: TestRunStepRecord[] = [];
      for (const s of result.steps) {
        const record = await insertTestRunStep(client, run.id, {
          stepIndex: s.index,
          action: s.action,
          status: s.status,
          durationMs: s.durationMs,
          ...(s.error ? { error: { name: s.error.name, message: s.error.message } } : {}),
        });
        steps.push(record);
      }

      const evidence: EvidenceRecord[] = [];
      if (result.evidence) {
        const failingStepId = pickFailingStepId(steps, result.evidence.failingStepIndex);
        for (const ref of artifactRefs) {
          const artifactRow = await insertArtifact(client, {
            storageKey: ref.storageKey,
            contentType: ref.contentType,
            byteSize: ref.byteSize,
            sha256: ref.sha256,
          });
          evidence.push(
            await insertEvidence(client, {
              testRunId: run.id,
              testRunStepId: failingStepId,
              evidenceType: ref.evidenceType,
              artifactId: artifactRow.id,
              metadata: ref.metadata,
            }),
          );
        }

        for (const rec of buildInlineEvidence(result.evidence)) {
          evidence.push(
            await insertEvidence(client, {
              testRunId: run.id,
              testRunStepId: failingStepId,
              evidenceType: rec.type,
              metadata: rec.metadata,
            }),
          );
        }
      }

      await client.query('COMMIT');
      logger.info('persistence:test-run-saved', {
        testRunId: run.id,
        externalTestId: run.external_test_id,
        stepCount: steps.length,
        evidenceCount: evidence.length,
      });
      return { run, steps, evidence };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      logger.error('persistence:test-run-failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      await this.cleanupOrphans(orphanKeys);
      throw err;
    } finally {
      client.release();
    }
  }

  private async writeArtifacts(
    evidence: EvidencePackage | undefined,
  ): Promise<Array<{
    storageKey: string;
    contentType: string;
    byteSize: number;
    sha256: string;
    evidenceType: EvidenceType;
    metadata: Record<string, unknown>;
  }>> {
    if (!evidence) return [];
    const out: Array<{
      storageKey: string;
      contentType: string;
      byteSize: number;
      sha256: string;
      evidenceType: EvidenceType;
      metadata: Record<string, unknown>;
    }> = [];

    if (evidence.screenshot) {
      const buf = Buffer.from(evidence.screenshot.data, 'base64');
      const stored = await this.artifacts.save({
        content: buf,
        contentType: evidence.screenshot.mimeType,
      });
      out.push({
        ...stored,
        evidenceType: 'screenshot',
        metadata: {
          capturedAt: evidence.screenshot.capturedAt,
          byteLength: evidence.screenshot.byteLength,
        },
      });
    }

    if (evidence.dom) {
      const buf = Buffer.from(evidence.dom.html, 'utf8');
      const stored = await this.artifacts.save({
        content: buf,
        contentType: 'text/html',
      });
      out.push({
        ...stored,
        evidenceType: 'dom',
        metadata: {
          capturedAt: evidence.dom.capturedAt,
          truncated: evidence.dom.truncated,
          byteLength: evidence.dom.byteLength,
        },
      });
    }

    return out;
  }

  private async cleanupOrphans(keys: string[]): Promise<void> {
    for (const k of keys) {
      try {
        await this.artifacts.delete(k);
      } catch (err) {
        logger.warn('persistence:orphan-cleanup-failed', {
          storageKey: k,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

function pickFailingStepId(
  steps: TestRunStepRecord[],
  failingStepIndex: number | undefined,
): string | null {
  if (failingStepIndex === undefined) return null;
  return steps.find((s) => s.step_index === failingStepIndex)?.id ?? null;
}

function buildInlineEvidence(
  ev: EvidencePackage,
): Array<{ type: EvidenceType; metadata: Record<string, unknown> }> {
  const out: Array<{ type: EvidenceType; metadata: Record<string, unknown> }> = [];
  if (ev.consoleLogs.length > 0) {
    out.push({
      type: 'console',
      metadata: {
        logs: ev.consoleLogs,
        truncated: ev.metadata.truncated.console,
        count: ev.metadata.counts.consoleLogs,
      },
    });
  }
  if (ev.pageErrors.length > 0) {
    out.push({
      type: 'page_error',
      metadata: { errors: ev.pageErrors, count: ev.metadata.counts.pageErrors },
    });
  }
  if (ev.networkRequests.length > 0) {
    out.push({
      type: 'network',
      metadata: {
        requests: ev.networkRequests,
        failedCount: ev.metadata.counts.failedRequests,
        totalCount: ev.metadata.counts.networkRequests,
        truncated: ev.metadata.truncated.network,
      },
    });
  }
  if (ev.browser) {
    out.push({ type: 'browser_metadata', metadata: ev.browser as unknown as Record<string, unknown> });
  }
  return out;
}
