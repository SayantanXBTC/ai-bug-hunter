export interface QualityScoreComponent {
  raw: number;
  weightedContribution: number;
  explanation: string;
}

export interface QualityScoreBreakdown {
  passRate: QualityScoreComponent;
  criticalFailures: QualityScoreComponent;
  regressions: QualityScoreComponent;
  flaky: QualityScoreComponent;
  openBugSeverity: QualityScoreComponent;
  campaignHealth: QualityScoreComponent;
}

export interface QualityScoreResult {
  score: number;
  breakdown: QualityScoreBreakdown;
  computedAt: string;
  sampleSize: number;
  warning?: string;
}

export interface DashboardOverviewResponse {
  qualityScore: QualityScoreResult;
  applications: { count: number };
  testRuns: {
    totalRecent: number;
    passed: number;
    failed: number;
    errored: number;
    avgDurationMs: number;
  };
  bugs: {
    openClusters: number;
    regressed: number;
    severityCounts: Record<string, number>;
  };
  flakyTests: { count: number };
  recentCampaign: {
    id: string;
    name: string;
    quality: string | null;
    passed: number;
    failed: number;
    createdAt: string;
  } | null;
  aiMetrics: {
    requestCount: number;
    successCount: number;
    failureCount: number;
    provider: string | null;
    model: string | null;
  };
}

export type TrendMetric =
  | 'passRate'
  | 'failureRate'
  | 'flakyRate'
  | 'qualityScore'
  | 'bugCount'
  | 'regressionCount'
  | 'avgDuration';

export interface TrendBucket {
  startIso: string;
  endIso: string;
  value: number;
  sampleSize: number;
}

export interface TrendResponse {
  metric: TrendMetric;
  window: '7d' | '30d' | '90d';
  buckets: TrendBucket[];
  insufficient: boolean;
}
