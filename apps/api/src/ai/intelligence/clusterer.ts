import type { TestRunRecord } from '../../db/repositories/testRunRepo.js';
import { primaryFailureSignature } from './fingerprintBuilder.js';
import { fingerprintHash } from './normalizers.js';
import { scoreSimilarity, STRONG_THRESHOLD } from './similarityScorer.js';
import type {
  AnalyzeSummary,
  BugCluster,
  ClusterStatus,
  FailureFingerprint,
  RegressionStatus,
  SimilaritySignal,
} from './intelligenceTypes.js';
import { UnionFind } from './unionFind.js';
import { generateCandidatePairs } from './candidateBlocker.js';
import { AiPairComparator, safeFingerprintView } from './aiComparator.js';

export interface ClusterMemberDraft {
  testRunId: string;
  similarityScore: number;
  membershipReason: SimilaritySignal[];
}

export interface ClusterDraft {
  fingerprintKey: string;
  title: string;
  description: string;
  status: ClusterStatus;
  severity: BugCluster['severity'];
  confidence: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  affectedTestCount: number;
  affectedPageCount: number;
  affectedEndpointCount: number;
  regressionStatus: RegressionStatus;
  primaryRunId: string;
  primaryInvestigationId: string | null;
  primaryFailureSignature: string;
  rootCauseSummary: string | null;
  members: ClusterMemberDraft[];
}

export interface ClustererOptions {
  maxCandidatePairs: number;
  maxAiComparisons: number;
  aiConfidenceThreshold: number;
  minResolutionPassStreak: number;
}

export const DEFAULT_CLUSTERER_OPTIONS: ClustererOptions = {
  maxCandidatePairs: 2000,
  maxAiComparisons: 100,
  aiConfidenceThreshold: 0.75,
  minResolutionPassStreak: 3,
};

export interface ClusterInput {
  fingerprints: FailureFingerprint[];
  runsById: Map<string, TestRunRecord>;
  passHistoryByExternalTestId: Map<string, TestRunRecord[]>;
  investigationSummaryByRunId?: Map<string, string>;
  comparator?: AiPairComparator;
  options?: Partial<ClustererOptions>;
}

export interface ClusterOutput {
  drafts: ClusterDraft[];
  summary: AnalyzeSummary;
}

export async function clusterFingerprints(input: ClusterInput): Promise<ClusterOutput> {
  const started = Date.now();
  const opts = { ...DEFAULT_CLUSTERER_OPTIONS, ...(input.options ?? {}) };

  const uf = new UnionFind();
  for (const fp of input.fingerprints) uf.add(fp.testRunId);

  const candidatePairs = generateCandidatePairs(input.fingerprints, opts.maxCandidatePairs);
  const pairScoreByPair = new Map<string, { score: number; reasons: SimilaritySignal[] }>();

  let deterministicStrongPairs = 0;
  const ambiguousPairs: Array<{
    a: FailureFingerprint;
    b: FailureFingerprint;
    score: number;
    reasons: SimilaritySignal[];
  }> = [];

  for (const cp of candidatePairs) {
    const s = scoreSimilarity(cp.a, cp.b);
    pairScoreByPair.set(pairKey(cp.a.testRunId, cp.b.testRunId), {
      score: s.score,
      reasons: s.signals,
    });
    if (s.band === 'strong') {
      uf.union(cp.a.testRunId, cp.b.testRunId);
      deterministicStrongPairs += 1;
    } else if (s.band === 'possible') {
      ambiguousPairs.push({ a: cp.a, b: cp.b, score: s.score, reasons: s.signals });
    }
  }

  let aiComparisons = 0;
  if (input.comparator && ambiguousPairs.length > 0) {
    const validRunIds = new Set(input.fingerprints.map((f) => f.testRunId));
    const cap = Math.min(ambiguousPairs.length, opts.maxAiComparisons);
    // Sort by deterministic score descending so top ambiguous candidates get AI attention.
    ambiguousPairs.sort((x, y) => y.score - x.score);
    for (let i = 0; i < cap; i += 1) {
      const p = ambiguousPairs[i]!;
      const cmp = await input.comparator.compare(
        { a: safeFingerprintView(p.a), b: safeFingerprintView(p.b) },
        validRunIds,
      );
      aiComparisons += 1;
      if (cmp && cmp.sameUnderlyingBug && cmp.confidence >= opts.aiConfidenceThreshold) {
        uf.union(p.a.testRunId, p.b.testRunId);
        p.reasons.push({
          name: 'ai_same_underlying_bug',
          contribution: 0,
          explanation: `AI: ${cmp.explanation} (confidence ${Math.round(cmp.confidence * 100)}%)`,
        });
        pairScoreByPair.set(pairKey(p.a.testRunId, p.b.testRunId), {
          score: Math.max(p.score, STRONG_THRESHOLD),
          reasons: p.reasons,
        });
      }
    }
  }

  const components = uf.components();
  const fingerprintById = new Map(input.fingerprints.map((f) => [f.testRunId, f]));
  const drafts: ClusterDraft[] = [];

  for (const [, memberIds] of components) {
    const members = memberIds
      .map((id) => fingerprintById.get(id))
      .filter((f): f is FailureFingerprint => f !== undefined);
    if (members.length === 0) continue;

    const primary = pickPrimary(members);
    const signature = primaryFailureSignature(primary);
    const fingerprintKey = fingerprintHash([
      primary.errorSignature.category,
      primary.normalizedPath || primary.externalTestId,
      primary.failedRequestPaths[0] ?? '',
      primary.errorSignature.normalizedMessage.slice(0, 60),
    ]);

    const timestamps = members.map((m) => new Date(m.startedAt).getTime()).sort((a, b) => a - b);
    const firstSeenAt = new Date(timestamps[0]!);
    const lastSeenAt = new Date(timestamps[timestamps.length - 1]!);
    const affectedTests = new Set(members.map((m) => m.externalTestId));
    const affectedPages = new Set(members.map((m) => m.normalizedPath).filter((p) => p.length > 0));
    const endpoints = new Set(members.flatMap((m) => m.failedRequestPaths));

    const passHistory = input.passHistoryByExternalTestId;
    const regressionStatus = computeRegressionStatus(members, passHistory, opts);
    const status = statusFromRegression(regressionStatus, members.length);

    const draftMembers: ClusterMemberDraft[] = members.map((m) => {
      const info = bestReasonForMember(m, members, pairScoreByPair);
      return {
        testRunId: m.testRunId,
        similarityScore: info.score,
        membershipReason: info.reasons,
      };
    });

    drafts.push({
      fingerprintKey,
      title: titleFor(primary),
      description: signature,
      status,
      severity: primary.severity as ClusterDraft['severity'],
      confidence: confidenceFor(members),
      firstSeenAt,
      lastSeenAt,
      occurrenceCount: members.length,
      affectedTestCount: affectedTests.size,
      affectedPageCount: affectedPages.size,
      affectedEndpointCount: endpoints.size,
      regressionStatus,
      primaryRunId: primary.testRunId,
      primaryInvestigationId: primary.investigationId,
      primaryFailureSignature: signature,
      rootCauseSummary: input.investigationSummaryByRunId?.get(primary.testRunId) ?? null,
      members: draftMembers,
    });
  }

  return {
    drafts,
    summary: {
      analyzedRuns: input.fingerprints.length,
      candidatePairs: candidatePairs.length,
      aiComparisons,
      deterministicStrongPairs,
      clustersCreated: 0,
      clustersUpdated: 0,
      durationMs: Date.now() - started,
      skippedReasons: {},
    },
  };
}

function pickPrimary(members: FailureFingerprint[]): FailureFingerprint {
  const withInvestigation = members.filter((m) => m.investigationId !== null);
  const pool = withInvestigation.length > 0 ? withInvestigation : members;
  return [...pool].sort((a, b) => (a.startedAt > b.startedAt ? -1 : 1))[0]!;
}

function bestReasonForMember(
  m: FailureFingerprint,
  members: FailureFingerprint[],
  pairScoreByPair: Map<string, { score: number; reasons: SimilaritySignal[] }>,
): { score: number; reasons: SimilaritySignal[] } {
  let best: { score: number; reasons: SimilaritySignal[] } = {
    score: 0,
    reasons: [
      { name: 'seed_member', contribution: 0, explanation: 'Initial cluster member' },
    ],
  };
  for (const other of members) {
    if (other.testRunId === m.testRunId) continue;
    const info = pairScoreByPair.get(pairKey(m.testRunId, other.testRunId));
    if (info && info.score > best.score) best = info;
  }
  return best;
}

function titleFor(fp: FailureFingerprint): string {
  if (fp.httpStatuses.length > 0 && fp.failedRequestPaths.length > 0) {
    return `HTTP ${fp.httpStatuses[0]} on ${fp.failedRequestPaths[0]}`;
  }
  if (fp.errorSignature.category === 'timeout') {
    return `Timeout on ${fp.selectorSignature ?? (fp.normalizedPath || fp.testName)}`;
  }
  if (fp.errorSignature.category === 'selector') {
    return `Selector failure on ${fp.normalizedPath || fp.testName}`;
  }
  if (fp.errorSignature.category !== 'unknown') {
    return `${cap(fp.errorSignature.category)} error on ${fp.normalizedPath || fp.testName}`;
  }
  return `Failure in ${fp.testName}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function confidenceFor(members: FailureFingerprint[]): number {
  const withInvestigation = members.filter((m) => m.investigationId !== null).length;
  const base = 0.5 + Math.min(0.4, members.length * 0.05);
  const boost = withInvestigation > 0 ? 0.1 : 0;
  return Math.min(1, base + boost);
}

function statusFromRegression(rs: RegressionStatus, count: number): ClusterStatus {
  if (rs === 'regressed') return 'regressed';
  if (rs === 'resolved') return 'resolved';
  if (rs === 'first_seen') return 'open';
  if (count > 1) return 'recurring';
  return 'inconclusive';
}

function computeRegressionStatus(
  members: FailureFingerprint[],
  passHistoryByExternalTestId: Map<string, TestRunRecord[]>,
  opts: ClustererOptions,
): RegressionStatus {
  const testIds = Array.from(new Set(members.map((m) => m.externalTestId)));
  const firstFailureAt = new Date(
    Math.min(...members.map((m) => new Date(m.startedAt).getTime())),
  );
  const lastFailureAt = new Date(
    Math.max(...members.map((m) => new Date(m.startedAt).getTime())),
  );

  let sawPriorPass = false;
  let allPriorPassed = true;
  let priorPassCount = 0;
  let laterPassStreak = 0;

  for (const testId of testIds) {
    const history = passHistoryByExternalTestId.get(testId) ?? [];
    // sorted ASC by started_at
    const sorted = [...history].sort((a, b) => a.started_at.getTime() - b.started_at.getTime());
    const prior = sorted.filter((r) => r.started_at.getTime() < firstFailureAt.getTime());
    if (prior.length > 0) {
      sawPriorPass = sawPriorPass || prior.some((r) => r.status === 'passed');
      if (prior.some((r) => r.status !== 'passed')) allPriorPassed = false;
      priorPassCount += prior.filter((r) => r.status === 'passed').length;
    } else {
      allPriorPassed = false;
    }
    const later = sorted.filter((r) => r.started_at.getTime() > lastFailureAt.getTime());
    let streak = 0;
    for (const r of later) {
      if (r.status === 'passed') streak += 1;
      else {
        streak = 0;
        break;
      }
    }
    laterPassStreak = Math.max(laterPassStreak, streak);
  }

  if (laterPassStreak >= opts.minResolutionPassStreak) return 'resolved';
  if (sawPriorPass && allPriorPassed && priorPassCount >= 2) return 'regressed';
  if (members.length === 1 && !sawPriorPass) return 'first_seen';
  if (members.length > 1) return 'recurring';
  return 'inconclusive';
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
