export {
  DEFAULT_EXECUTION_OPTIONS,
  type BrowserName,
  type ExecutionOptions,
  type ExecutionResult,
  type ExecutionStatus,
  type NormalizedError,
  type StepResult,
  type StepStatus,
  type TestAction,
  type TestActionName,
  type TestDefinition,
} from './types/execution.js';

export {
  TestActionSchema,
  TestDefinitionSchema,
  assertSafeUrl,
  type ValidatedTestAction,
  type ValidatedTestDefinition,
} from './actions/actionTypes.js';

export { BrowserManager, type BrowserSession, type BrowserManagerOptions } from './browser/browserManager.js';
export { TestExecutor, type TestExecutorOptions, normalizeError } from './executor/testExecutor.js';
export { logger, type Logger, type LogLevel } from './logger.js';
