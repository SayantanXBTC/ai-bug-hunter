export type ReliabilityStatus =
  | 'stable'
  | 'suspected_flaky'
  | 'flaky'
  | 'unstable'
  | 'insufficient_data';

export interface DurationStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  stddev: number;
  count: number;
}

export interface FlakySignal {
  name: string;
  contribution: number;
  explanation: string;
}

export interface EnvironmentBreakdown {
  browsers: Record<string, { runs: number; failures: number }>;
  correlationDetected: boolean;
}

export interface FailureSignatureCount {
  signature: string;
  count: number;
  bugClusterId: string | null;
}

export interface TestReliability {
  testCaseId: string | null;
  externalTestId: string;
  testName: string;
  totalRuns: number;
  passCount: number;
  failureCount: number;
  errorCount: number;
  passRate: number;
  failureRate: number;
  flakyScore: number;
  reliabilityScore: number;
  status: ReliabilityStatus;
  firstRunAt: string | null;
  lastRunAt: string | null;
  consecutivePasses: number;
  consecutiveFailures: number;
  failureSignatures: FailureSignatureCount[];
  durationStats: DurationStats;
  environmentSignals: EnvironmentBreakdown;
  signals: FlakySignal[];
  explanation: string;
  calculatedAt: string;
}
