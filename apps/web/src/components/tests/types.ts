// Shared types for the Tests feature. Shapes mirror backend responses from
// GET /api/test-cases, GET /api/test-runs, POST /api/ai/generate-tests, and
// GET /api/ai/test-reliability/:externalTestId.

export type TestCasePriority = 'critical' | 'high' | 'medium' | 'low';
export type TestCaseSource = 'generated' | 'manual' | 'imported';

export interface TestActionRecord {
  action: string;
  url?: string;
  selector?: string;
  value?: string;
  key?: string;
  durationMs?: number;
  timeoutMs?: number;
  [key: string]: unknown;
}

export interface TestDefinitionRecord {
  id: string;
  name: string;
  targetUrl: string;
  steps: TestActionRecord[];
  timeoutMs?: number;
}

export interface TestCaseRow {
  id: string;
  application_id: string | null;
  name: string;
  description: string | null;
  target_url: string;
  definition: TestDefinitionRecord;
  priority: TestCasePriority;
  enabled: boolean;
  tags: string[];
  source: TestCaseSource;
  external_test_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestCaseListResponse {
  items: TestCaseRow[];
  page: number;
  limit: number;
  total: number;
}

export interface TestRunSummary {
  id: string;
  testId: string | null;
  testName: string | null;
  status: 'passed' | 'failed' | 'errored' | 'running' | 'pending' | string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface TestRunListResponse {
  items: TestRunSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface TestRunDetailStep {
  index: number;
  action: string;
  status: string;
  durationMs: number | null;
  error?: { name?: string; message?: string };
}

export interface TestRunDetailResponse {
  id: string;
  testId: string | null;
  testName: string | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  error?: { name?: string; message?: string; stepIndex?: number | null };
  steps: TestRunDetailStep[];
  evidence: Array<{ id: string; type: string; [key: string]: unknown }>;
}

export interface ApplicationOption {
  id: string;
  name: string;
  base_url: string;
}

export interface ReliabilityRecord {
  externalTestId: string;
  totalRuns: number;
  passCount?: number;
  failCount?: number;
  errorCount?: number;
  passRate: number;
  flakyScore: number;
  status: 'stable' | 'suspected_flaky' | 'flaky' | 'unstable' | 'insufficient_data' | string;
  lastRunAt?: string | null;
  minRuns?: number;
}

// Response from POST /api/ai/generate-tests
export type GenerationStatus = 'success' | 'validation_error' | 'provider_error';

export interface GeneratedTestIssue {
  kind: string;
  message: string;
  stepIndex?: number;
  selector?: string;
  url?: string;
}

export interface ValidatedGeneratedTest {
  test: TestDefinitionRecord;
  description?: string;
  category?: string;
  validationStatus: 'valid' | 'invalid';
  issues: GeneratedTestIssue[];
}

export interface GenerationResponse {
  status: GenerationStatus;
  tests: ValidatedGeneratedTest[];
  warnings: string[];
  provider: string;
  model: string;
  durationMs: number;
  message?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export function sourceOfTestCase(t: TestCaseRow): 'ai' | 'manual' {
  if (t.source === 'generated') return 'ai';
  if (Array.isArray(t.tags) && t.tags.some((tag) => tag.toLowerCase() === 'ai-generated')) return 'ai';
  return 'manual';
}
