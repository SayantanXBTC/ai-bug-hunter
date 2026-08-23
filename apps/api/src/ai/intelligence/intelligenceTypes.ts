import type { BugSeverity, FailureClassification } from '../investigation/investigationTypes.js';

export type ErrorCategory =
  | 'timeout'
  | 'selector'
  | 'javascript'
  | 'network'
  | 'http'
  | 'assertion'
  | 'navigation'
  | 'unknown';

export interface ErrorSignature {
  type: string;
  normalizedMessage: string;
  category: ErrorCategory;
}

export interface FailureFingerprint {
  testRunId: string;
  externalTestId: string;
  testName: string;
  classification: FailureClassification | 'unknown';
  severity: BugSeverity | 'unknown';
  failedStepIndex: number | null;
  actionType: string | null;
  errorSignature: ErrorSignature;
  failureType: string | null;
  targetUrl: string;
  normalizedPath: string;
  httpStatuses: number[];
  failedRequestPaths: string[];
  consoleErrorSignatures: string[];
  pageErrorSignatures: string[];
  selectorSignature: string | null;
  affectedArea: string | null;
  browserName: string | null;
  browserVersion: string | null;
  evidenceTypes: string[];
  investigationId: string | null;
  startedAt: string;
  status: 'failed' | 'error';
}

export interface SimilaritySignal {
  name: string;
  contribution: number;
  explanation: string;
}

export type SimilarityBand = 'strong' | 'possible' | 'unlikely';

export interface SimilarityScore {
  score: number;
  band: SimilarityBand;
  signals: SimilaritySignal[];
}

export type ClusterStatus = 'open' | 'recurring' | 'regressed' | 'resolved' | 'inconclusive';
export type RegressionStatus =
  | 'first_seen'
  | 'recurring'
  | 'regressed'
  | 'resolved'
  | 'inconclusive';

export interface BugCluster {
  id: string;
  fingerprintKey: string;
  title: string;
  description: string | null;
  status: ClusterStatus;
  severity: BugSeverity | 'unknown';
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  affectedTestCount: number;
  affectedPageCount: number;
  affectedEndpointCount: number;
  regressionStatus: RegressionStatus;
  primaryRunId: string | null;
  primaryInvestigationId: string | null;
  primaryFailureSignature: string | null;
  rootCauseSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BugClusterMember {
  clusterId: string;
  testRunId: string;
  similarityScore: number;
  membershipReason: SimilaritySignal[];
  createdAt: string;
}

export interface ClusterTimelineEvent {
  at: string;
  testRunId: string;
  externalTestId: string;
  status: 'passed' | 'failed' | 'error';
  kind: 'first_seen' | 'recurrence' | 'regression' | 'pass';
}

export interface AnalyzeSummary {
  analyzedRuns: number;
  candidatePairs: number;
  aiComparisons: number;
  deterministicStrongPairs: number;
  clustersCreated: number;
  clustersUpdated: number;
  durationMs: number;
  skippedReasons: Record<string, number>;
}
