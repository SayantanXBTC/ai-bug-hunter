export const FAILURE_CLASSIFICATIONS = [
  'application_defect',
  'test_defect',
  'environment_failure',
  'dependency_failure',
  'data_failure',
  'inconclusive',
] as const;
export type FailureClassification = (typeof FAILURE_CLASSIFICATIONS)[number];

export const BUG_SEVERITIES = ['critical', 'high', 'medium', 'low', 'none'] as const;
export type BugSeverity = (typeof BUG_SEVERITIES)[number];

export type FailureType =
  | 'timeout'
  | 'selector'
  | 'http_5xx'
  | 'http_4xx'
  | 'network'
  | 'aborted'
  | 'js_error'
  | 'page_error'
  | 'other';

export interface ObservedFact {
  id: string;
  type:
    | 'test_status'
    | 'step_failed'
    | 'error'
    | 'console_error'
    | 'page_error'
    | 'network_failure'
    | 'http_error'
    | 'artifact_present'
    | 'historical';
  description: string;
  source: string;
}

export interface EvidenceReference {
  evidenceId: string;
  evidenceType: 'screenshot' | 'dom' | 'console' | 'page_error' | 'network' | 'browser_metadata';
  description: string;
}

export interface Hypothesis {
  id: string;
  statement: string;
  confidence: number;
  reasoningSummary: string;
  observedFactIds: string[];
  evidenceIds: string[];
}

export interface ReproductionStep {
  order: number;
  stepIndex: number;
  action: string;
  description: string;
}

export interface FailureSignals {
  failedStepIndex: number | null;
  failureType: FailureType | null;
  hasScreenshot: boolean;
  hasDom: boolean;
  consoleErrorCount: number;
  pageErrorCount: number;
  networkFailureCount: number;
  httpErrorCount: number;
  http5xxCount: number;
  http4xxCount: number;
  previousRunCount: number;
  previousPassCount: number;
  previousFailureCount: number;
  consecutivePreviousPasses: number;
  firstObservedFailure: boolean;
}

export interface InvestigationReport {
  id: string;
  testRunId: string;
  classification: FailureClassification;
  severity: BugSeverity;
  confidence: number;
  summary: string;
  likelyRootCause: string | null;
  affectedArea: string | null;
  observedFacts: ObservedFact[];
  hypotheses: Hypothesis[];
  supportingEvidence: EvidenceReference[];
  reproductionSteps: ReproductionStep[];
  recommendedNextSteps: string[];
  validationWarnings: string[];
  generatedAt: string;
  provider: string;
  model: string;
  durationMs: number;
}

export type InvestigationStatus = 'ok' | 'not_investigable' | 'provider_error' | 'validation_error';

export interface InvestigationResponse {
  status: InvestigationStatus;
  report?: InvestigationReport;
  message?: string;
}
