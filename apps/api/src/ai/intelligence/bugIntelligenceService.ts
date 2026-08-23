import type { Pool } from 'pg';
import { logger } from '@ai-bug-hunter/test-engine';
import type { LLMProvider } from '../providers/llmProvider.js';
import type { TestRunRecord } from '../../db/repositories/testRunRepo.js';
import type { EvidenceRecord } from '../../db/repositories/evidenceRepo.js';
import { listEvidenceForRun } from '../../db/repositories/evidenceRepo.js';
import { listStepsForRun } from '../../db/repositories/testRunRepo.js';
import { getInvestigationByTestRunId } from '../../db/repositories/investigationRepo.js';
import { buildFingerprint } from './fingerprintBuilder.js';
import { clusterFingerprints, type ClusterDraft } from './clusterer.js';
import { AiPairComparator } from './aiComparator.js';
import type { AnalyzeSummary, FailureFingerprint } from './intelligenceTypes.js';
import {
  upsertCluster,
  upsertMember,
  getClusterByFingerprintKey,
} from '../../db/repositories/bugClusterRepo.js';

export interface BugIntelligenceServiceOptions {
  pool: Pool;
  provider: LLMProvider | null;
  model: string;
  maxRuns: number;
  maxCandidatePairs: number;
  maxAiComparisons: number;
  minResolutionPassStreak: number;
  /** Owner id to stamp on newly-created bug_clusters rows. */
  ownerId?: string | null;
  /** Optional ownership scope for reading test_runs during analyze. */
  scope?: { ownerId: string; isAdmin: boolean };
}

export interface AnalyzeInput {
  since?: Date;
  testRunIds?: string[];
}

export class BugIntelligenceService {
  constructor(private readonly opts: BugIntelligenceServiceOptions) {}

  async analyze(input: AnalyzeInput = {}): Promise<AnalyzeSummary> {
    const started = Date.now();
    const runs = await this.loadFailedRuns(input);
    logger.info('intel:analyze-start', {
      candidateRuns: runs.length,
      since: input.since?.toISOString() ?? null,
    });

    if (runs.length === 0) {
      return emptySummary(Date.now() - started);
    }

    // Load evidence, steps, investigations, and pass history in bulk.
    const fingerprints: FailureFingerprint[] = [];
    const investigationSummaryByRunId = new Map<string, string>();
    const runsById = new Map<string, TestRunRecord>();

    for (const run of runs) {
      runsById.set(run.id, run);
      const [steps, evidence] = await Promise.all([
        listStepsForRun(this.opts.pool, run.id),
        listEvidenceForRun(this.opts.pool, run.id),
      ]);
      const investigation = await getInvestigationByTestRunId(this.opts.pool, run.id);
      const investigationReport = investigation ? investigation.report_json : null;
      if (investigationReport?.summary) {
        investigationSummaryByRunId.set(run.id, investigationReport.summary);
      }
      const fp = buildFingerprint({
        run,
        steps,
        evidence: filterEvidenceForFingerprint(evidence),
        investigation: investigationReport,
      });
      fingerprints.push(fp);
    }

    const externalTestIds = Array.from(new Set(fingerprints.map((f) => f.externalTestId)));
    const passHistoryByExternalTestId = await this.loadPassHistory(externalTestIds);

    const comparator =
      this.opts.provider && this.opts.maxAiComparisons > 0
        ? new AiPairComparator(this.opts.provider, this.opts.model)
        : undefined;

    const { drafts, summary } = await clusterFingerprints({
      fingerprints,
      runsById,
      passHistoryByExternalTestId,
      investigationSummaryByRunId,
      ...(comparator ? { comparator } : {}),
      options: {
        maxCandidatePairs: this.opts.maxCandidatePairs,
        maxAiComparisons: this.opts.maxAiComparisons,
        minResolutionPassStreak: this.opts.minResolutionPassStreak,
      },
    });

    let created = 0;
    let updated = 0;
    for (const d of drafts) {
      const existing = await getClusterByFingerprintKey(this.opts.pool, d.fingerprintKey);
      const savedRow = await upsertCluster(this.opts.pool, {
        fingerprintKey: d.fingerprintKey,
        title: d.title,
        description: d.description,
        status: d.status,
        severity: d.severity,
        confidence: d.confidence,
        firstSeenAt: d.firstSeenAt,
        lastSeenAt: d.lastSeenAt,
        occurrenceCount: d.occurrenceCount,
        affectedTestCount: d.affectedTestCount,
        affectedPageCount: d.affectedPageCount,
        affectedEndpointCount: d.affectedEndpointCount,
        regressionStatus: d.regressionStatus,
        primaryRunId: d.primaryRunId,
        primaryInvestigationId: d.primaryInvestigationId,
        primaryFailureSignature: d.primaryFailureSignature,
        rootCauseSummary: d.rootCauseSummary,
        ownerId: this.opts.ownerId ?? null,
      });
      for (const m of d.members) {
        await upsertMember(this.opts.pool, savedRow.id, m.testRunId, m.similarityScore, m.membershipReason);
      }
      if (existing) updated += 1;
      else created += 1;
    }

    const finalSummary: AnalyzeSummary = {
      ...summary,
      clustersCreated: created,
      clustersUpdated: updated,
      durationMs: Date.now() - started,
    };
    logger.info('intel:analyze-complete', finalSummary as unknown as Record<string, unknown>);
    return finalSummary;
  }

  private async loadFailedRuns(input: AnalyzeInput): Promise<TestRunRecord[]> {
    const scope = this.opts.scope;
    if (input.testRunIds && input.testRunIds.length > 0) {
      const params: unknown[] = [input.testRunIds];
      let where = "id = ANY($1::uuid[]) AND status IN ('failed','error')";
      if (scope && !scope.isAdmin) {
        params.push(scope.ownerId);
        where += ` AND owner_id = $${params.length}`;
      }
      params.push(this.opts.maxRuns);
      const { rows } = await this.opts.pool.query<TestRunRecord>(
        `SELECT * FROM test_runs
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      return rows;
    }
    const params: unknown[] = [];
    let where = "status IN ('failed','error')";
    if (input.since) {
      params.push(input.since);
      where += ` AND created_at >= $${params.length}`;
    }
    if (scope && !scope.isAdmin) {
      params.push(scope.ownerId);
      where += ` AND owner_id = $${params.length}`;
    }
    params.push(this.opts.maxRuns);
    const { rows } = await this.opts.pool.query<TestRunRecord>(
      `SELECT * FROM test_runs WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows;
  }

  private async loadPassHistory(externalTestIds: string[]): Promise<Map<string, TestRunRecord[]>> {
    const map = new Map<string, TestRunRecord[]>();
    if (externalTestIds.length === 0) return map;
    const { rows } = await this.opts.pool.query<TestRunRecord>(
      `SELECT * FROM test_runs
       WHERE external_test_id = ANY($1::text[])
       ORDER BY started_at ASC`,
      [externalTestIds],
    );
    for (const r of rows) {
      let arr = map.get(r.external_test_id);
      if (!arr) {
        arr = [];
        map.set(r.external_test_id, arr);
      }
      arr.push(r);
    }
    return map;
  }
}

function filterEvidenceForFingerprint(evidence: EvidenceRecord[]): EvidenceRecord[] {
  // Keep only structured metadata evidence — never sends binary artifacts to fingerprinting.
  return evidence.filter((e) =>
    ['console', 'page_error', 'network', 'browser_metadata'].includes(e.evidence_type),
  );
}

function emptySummary(durationMs: number): AnalyzeSummary {
  return {
    analyzedRuns: 0,
    candidatePairs: 0,
    aiComparisons: 0,
    deterministicStrongPairs: 0,
    clustersCreated: 0,
    clustersUpdated: 0,
    durationMs,
    skippedReasons: {},
  };
}

export type { ClusterDraft };
