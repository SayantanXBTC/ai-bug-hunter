import type { TestRunRecord, TestRunStepRecord } from '../../db/repositories/testRunRepo.js';
import type { EvidenceRecord, ArtifactRecord } from '../../db/repositories/evidenceRepo.js';
import type { FailureSignals, ObservedFact } from './investigationTypes.js';
import type { ImageEvidenceInput } from '../providers/llmProvider.js';

export interface ContextLimits {
  maxConsoleMessages: number;
  maxNetworkEntries: number;
  maxDomBytes: number;
  maxHistoricalRuns: number;
}

export const DEFAULT_CONTEXT_LIMITS: ContextLimits = {
  maxConsoleMessages: 50,
  maxNetworkEntries: 100,
  maxDomBytes: 20_000,
  maxHistoricalRuns: 10,
};

export interface HistoricalRunSummary {
  id: string;
  status: 'passed' | 'failed' | 'error';
  startedAt: string;
  durationMs: number;
  errorMessage?: string;
}

export interface InvestigationContextView {
  testRun: {
    id: string;
    externalTestId: string;
    testName: string;
    status: string;
    durationMs: number;
    startedAt: string;
    finishedAt: string;
    error?: { name: string; message: string; stepIndex?: number };
  };
  steps: Array<{ index: number; action: string; status: string; durationMs: number; error?: { name: string; message: string } }>;
  evidenceIndex: Array<{
    id: string;
    type: string;
    hasArtifact: boolean;
    contentType?: string;
    byteSize?: number;
    metadata: Record<string, unknown>;
  }>;
  browserMetadata?: Record<string, unknown>;
  domExcerpt?: { evidenceId: string; text: string; truncated: boolean };
  failureSignals: FailureSignals;
  historicalRuns: HistoricalRunSummary[];
  observedFacts: ObservedFact[];
}

export interface InvestigationContextBundle {
  view: InvestigationContextView;
  images: ImageEvidenceInput[];
  observedFactIndex: Set<string>;
  evidenceById: Map<string, EvidenceRecord>;
  stepIndexSet: Set<number>;
}

export function buildObservedFacts(
  run: TestRunRecord,
  steps: TestRunStepRecord[],
  evidence: EvidenceRecord[],
  signals: FailureSignals,
  history: HistoricalRunSummary[],
): ObservedFact[] {
  const facts: ObservedFact[] = [];
  let n = 0;
  const push = (
    type: ObservedFact['type'],
    description: string,
    source: string,
  ): void => {
    n += 1;
    facts.push({ id: `fact-${n}`, type, description, source });
  };

  push('test_status', `Test run status is "${run.status}".`, `test_runs.${run.id}`);
  if (run.error_name || run.error_message) {
    push(
      'error',
      `Execution error: ${run.error_name ?? 'Error'} — ${run.error_message ?? ''}`.trim(),
      `test_runs.${run.id}`,
    );
  }
  const failedStep = steps.find((s) => s.status === 'failed');
  if (failedStep) {
    push(
      'step_failed',
      `Step ${failedStep.step_index} (${failedStep.action}) failed after ${failedStep.duration_ms}ms${failedStep.error_message ? ': ' + failedStep.error_message : '.'}`,
      `test_run_steps.${failedStep.id}`,
    );
  }
  if (signals.consoleErrorCount > 0) {
    push(
      'console_error',
      `${signals.consoleErrorCount} console error(s) captured during the run.`,
      'evidence.console',
    );
  }
  if (signals.pageErrorCount > 0) {
    push(
      'page_error',
      `${signals.pageErrorCount} uncaught page error(s) captured during the run.`,
      'evidence.page_error',
    );
  }
  if (signals.http5xxCount > 0) {
    push(
      'http_error',
      `${signals.http5xxCount} HTTP 5xx response(s) observed in network evidence.`,
      'evidence.network',
    );
  }
  if (signals.http4xxCount > 0) {
    push(
      'http_error',
      `${signals.http4xxCount} HTTP 4xx response(s) observed in network evidence.`,
      'evidence.network',
    );
  }
  if (signals.networkFailureCount > 0) {
    push(
      'network_failure',
      `${signals.networkFailureCount} non-HTTP network failure(s) (e.g. aborted, DNS) observed.`,
      'evidence.network',
    );
  }
  for (const ev of evidence) {
    if (ev.evidence_type === 'screenshot' || ev.evidence_type === 'dom') {
      push('artifact_present', `${ev.evidence_type} artifact is available.`, `evidence.${ev.id}`);
    }
  }
  if (history.length > 0) {
    push(
      'historical',
      `${history.length} previous run(s) recorded for this test id (${signals.previousPassCount} passed, ${signals.previousFailureCount} failed). Consecutive preceding passes: ${signals.consecutivePreviousPasses}. First observed failure: ${signals.firstObservedFailure}.`,
      'test_runs.history',
    );
  }
  return facts;
}

export interface BuildContextInput {
  run: TestRunRecord;
  steps: TestRunStepRecord[];
  evidence: EvidenceRecord[];
  artifactsById: Map<string, ArtifactRecord>;
  domText?: string;
  screenshot?: ImageEvidenceInput;
  history: HistoricalRunSummary[];
  signals: FailureSignals;
  limits?: ContextLimits;
}

export function buildInvestigationContext(input: BuildContextInput): InvestigationContextBundle {
  const limits = input.limits ?? DEFAULT_CONTEXT_LIMITS;
  const observedFacts = buildObservedFacts(
    input.run,
    input.steps,
    input.evidence,
    input.signals,
    input.history,
  );

  const evidenceIndex = input.evidence.map((e) => {
    const artifact = e.artifact_id ? input.artifactsById.get(e.artifact_id) : undefined;
    const metadata = compactEvidenceMetadata(e, limits);
    const entry: InvestigationContextView['evidenceIndex'][number] = {
      id: e.id,
      type: e.evidence_type,
      hasArtifact: Boolean(e.artifact_id),
      metadata,
    };
    if (artifact) {
      entry.contentType = artifact.content_type;
      entry.byteSize = Number(artifact.byte_size);
    }
    return entry;
  });

  const browserMeta = input.evidence.find((e) => e.evidence_type === 'browser_metadata');

  const view: InvestigationContextView = {
    testRun: {
      id: input.run.id,
      externalTestId: input.run.external_test_id,
      testName: input.run.test_name,
      status: input.run.status,
      durationMs: input.run.duration_ms,
      startedAt: input.run.started_at.toISOString(),
      finishedAt: input.run.finished_at.toISOString(),
      ...(input.run.error_name || input.run.error_message
        ? {
            error: {
              name: input.run.error_name ?? 'Error',
              message: input.run.error_message ?? '',
              ...(input.run.error_step_index !== null && input.run.error_step_index !== undefined
                ? { stepIndex: input.run.error_step_index }
                : {}),
            },
          }
        : {}),
    },
    steps: input.steps.map((s) => ({
      index: s.step_index,
      action: s.action,
      status: s.status,
      durationMs: s.duration_ms,
      ...(s.error_name || s.error_message
        ? { error: { name: s.error_name ?? 'Error', message: s.error_message ?? '' } }
        : {}),
    })),
    evidenceIndex,
    ...(browserMeta ? { browserMetadata: browserMeta.metadata } : {}),
    ...(input.domText
      ? {
          domExcerpt: {
            evidenceId: input.evidence.find((e) => e.evidence_type === 'dom')?.id ?? 'unknown',
            text: input.domText,
            truncated: input.domText.length >= limits.maxDomBytes,
          },
        }
      : {}),
    failureSignals: input.signals,
    historicalRuns: input.history.slice(0, limits.maxHistoricalRuns),
    observedFacts,
  };

  return {
    view,
    images: input.screenshot ? [input.screenshot] : [],
    observedFactIndex: new Set(observedFacts.map((f) => f.id)),
    evidenceById: new Map(input.evidence.map((e) => [e.id, e])),
    stepIndexSet: new Set(input.steps.map((s) => s.step_index)),
  };
}

function compactEvidenceMetadata(
  ev: EvidenceRecord,
  limits: ContextLimits,
): Record<string, unknown> {
  const raw = ev.metadata ?? {};
  if (ev.evidence_type === 'console') {
    const logs = (raw as { logs?: Array<{ type: string; text: string; timestamp?: string }> }).logs;
    if (Array.isArray(logs)) {
      return {
        logs: logs.slice(0, limits.maxConsoleMessages),
        totalCount: logs.length,
        truncated: logs.length > limits.maxConsoleMessages,
      };
    }
  }
  if (ev.evidence_type === 'network') {
    const requests = (raw as { requests?: unknown[] }).requests;
    if (Array.isArray(requests)) {
      return {
        requests: requests.slice(0, limits.maxNetworkEntries),
        totalCount: requests.length,
        truncated: requests.length > limits.maxNetworkEntries,
      };
    }
  }
  return raw as Record<string, unknown>;
}

export function sanitizeDom(html: string, maxBytes: number): string {
  // Strip <script> blocks entirely.
  let out = html.replace(/<script\b[\s\S]*?<\/script>/gi, '<script>[REMOVED]</script>');
  // Strip inline event handlers.
  out = out.replace(/\s(on\w+)="[^"]*"/gi, '');
  // Strip explicit token/password/authorization attributes (defence in depth).
  out = out.replace(/\s(value|data-token|data-secret)="[^"]*"/gi, '');
  if (out.length > maxBytes) out = out.slice(0, maxBytes) + '\n<!-- truncated -->';
  return out;
}
