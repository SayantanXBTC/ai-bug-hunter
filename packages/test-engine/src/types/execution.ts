export type BrowserName = 'chromium';

export interface ExecutionOptions {
  browser?: BrowserName;
  headless?: boolean;
  actionTimeoutMs?: number;
  navigationTimeoutMs?: number;
  testTimeoutMs?: number;
}

export const DEFAULT_EXECUTION_OPTIONS: Required<ExecutionOptions> = {
  browser: 'chromium',
  headless: true,
  actionTimeoutMs: 10_000,
  navigationTimeoutMs: 15_000,
  testTimeoutMs: 60_000,
};

export type TestAction =
  | { action: 'navigate'; url: string }
  | { action: 'click'; selector: string }
  | { action: 'fill'; selector: string; value: string }
  | { action: 'selectOption'; selector: string; value: string }
  | { action: 'press'; selector: string; key: string }
  | { action: 'waitForSelector'; selector: string; timeoutMs?: number }
  | { action: 'wait'; durationMs: number };

export type TestActionName = TestAction['action'];

export interface TestDefinition {
  id: string;
  name: string;
  targetUrl: string;
  steps: TestAction[];
  timeoutMs?: number;
}

export type StepStatus = 'passed' | 'failed' | 'skipped';
export type ExecutionStatus = 'passed' | 'failed' | 'error';

export interface NormalizedError {
  name: string;
  message: string;
  stepIndex?: number;
}

export interface StepResult {
  index: number;
  action: TestActionName;
  status: StepStatus;
  durationMs: number;
  error?: NormalizedError;
}

export interface ExecutionResult {
  testId: string;
  testName: string;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: StepResult[];
  error?: NormalizedError;
  evidence?: import('../evidence/evidenceTypes.js').EvidencePackage;
}
