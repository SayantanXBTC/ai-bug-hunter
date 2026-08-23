import type { TestCasePriority } from '../../db/repositories/testCaseRepo.js';

export type SelectionStrategy =
  | 'all_enabled'
  | 'risk_based'
  | 'changed_area'
  | 'bug_targeted'
  | 'smoke';

export type CampaignStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'error';
export type CampaignTrigger = 'manual' | 'api' | 'ci';
export type CampaignQuality = 'healthy' | 'degraded' | 'failed' | 'inconclusive';

export interface SelectionReasonSignal {
  name: string;
  contribution: number;
  explanation: string;
}

export interface SelectedTest {
  testCaseId: string;
  name: string;
  priority: TestCasePriority;
  selectionScore: number;
  selectionReason: SelectionReasonSignal[];
  associatedBugClusterIds: string[];
  flakyStatus: string;
}

export interface RegressionCampaignSummary {
  id: string;
  applicationId: string | null;
  name: string;
  status: CampaignStatus;
  trigger: CampaignTrigger;
  selectionStrategy: SelectionStrategy;
  requestedTestCount: number;
  selectedTestCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  errorRuns: number;
  quality: CampaignQuality | null;
  cancelRequested: boolean;
  createdAt: string;
}

export interface CampaignTestRecord {
  campaignId: string;
  testCaseId: string;
  selectionScore: number;
  selectionReason: SelectionReasonSignal[];
  executionRunId: string | null;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'error' | 'skipped';
  startedAt: string | null;
  finishedAt: string | null;
  ordinal: number;
}
