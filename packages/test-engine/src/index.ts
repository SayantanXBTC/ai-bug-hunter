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

export {
  DEFAULT_EVIDENCE_OPTIONS,
  type EvidenceOptions,
  type EvidencePackage,
  type ScreenshotEvidence,
  type DOMEvidence,
  type ConsoleEvidence,
  type ConsoleMessageType,
  type PageErrorEvidence,
  type NetworkEvidence,
  type NetworkFailureEvidence,
  type NetworkFailureType,
  type BrowserMetadata,
  type StepMetadata,
} from './evidence/evidenceTypes.js';

export {
  EvidenceCollector,
  type EvidenceCollectorContext,
} from './evidence/evidenceCollector.js';

export {
  InMemoryEvidenceStore,
  type EvidenceStore,
} from './evidence/evidenceStore.js';

export {
  DEFAULT_DISCOVERY_OPTIONS,
  type AccessibilityNode,
  type AccessibilitySnapshot,
  type ApplicationModel,
  type DiscoveredElement,
  type DiscoveredForm,
  type DiscoveredFormField,
  type DiscoveredHeading,
  type DiscoveredLink,
  type DiscoveryOptions,
  type DiscoveryResult,
  type DiscoveryStats,
  type DiscoveryWarning,
  type DiscoveryWarningKind,
  type ElementCategory,
  type PageModel,
  type ResolvedDiscoveryOptions,
  type SelectorCandidate,
  type SelectorStrategy,
} from './discovery/discoveryTypes.js';

export { DiscoveryEngine, type DiscoveryEngineOptions } from './discovery/discoveryEngine.js';

export {
  normalizeUrl,
  isInScope,
  isAllowedProtocol,
  isIgnoredProtocol,
  tryParseUrl,
} from './discovery/urlNormalizer.js';
