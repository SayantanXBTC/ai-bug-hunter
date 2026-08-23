import type { TestRunRecord, TestRunStepRecord } from '../../db/repositories/testRunRepo.js';
import type { EvidenceRecord } from '../../db/repositories/evidenceRepo.js';
import type { FailureSignals, FailureType } from './investigationTypes.js';

export interface HistoricalMini {
  status: 'passed' | 'failed' | 'error';
  createdAt: Date;
}

export function computeFailureSignals(
  run: TestRunRecord,
  steps: TestRunStepRecord[],
  evidence: EvidenceRecord[],
  history: HistoricalMini[],
): FailureSignals {
  const failed = steps.find((s) => s.status === 'failed') ?? null;
  const failedStepIndex = failed ? failed.step_index : null;

  const hasScreenshot = evidence.some((e) => e.evidence_type === 'screenshot');
  const hasDom = evidence.some((e) => e.evidence_type === 'dom');

  const consoleMeta = evidence.find((e) => e.evidence_type === 'console')?.metadata as
    | { logs?: Array<{ type: string }> }
    | undefined;
  const pageErrMeta = evidence.find((e) => e.evidence_type === 'page_error')?.metadata as
    | { errors?: unknown[] }
    | undefined;
  const networkMeta = evidence.find((e) => e.evidence_type === 'network')?.metadata as
    | {
        requests?: Array<{ status?: number; failure?: { type?: string; status?: number } }>;
        failedCount?: number;
      }
    | undefined;

  const consoleErrorCount = (consoleMeta?.logs ?? []).filter((l) => l.type === 'error').length;
  const pageErrorCount = (pageErrMeta?.errors ?? []).length;

  const requests = networkMeta?.requests ?? [];
  const failedRequests = requests.filter((r) => r.failure);
  const networkFailureCount = failedRequests.filter((r) => r.failure?.type !== 'http').length;
  const http4xxCount = failedRequests.filter((r) => {
    const status = r.status ?? r.failure?.status ?? 0;
    return status >= 400 && status < 500;
  }).length;
  const http5xxCount = failedRequests.filter((r) => {
    const status = r.status ?? r.failure?.status ?? 0;
    return status >= 500;
  }).length;
  const httpErrorCount = http4xxCount + http5xxCount;

  let failureType: FailureType | null = null;
  if (run.error_name?.toLowerCase().includes('timeout')) failureType = 'timeout';
  else if (http5xxCount > 0) failureType = 'http_5xx';
  else if (http4xxCount > 0) failureType = 'http_4xx';
  else if (pageErrorCount > 0) failureType = 'page_error';
  else if (consoleErrorCount > 0) failureType = 'js_error';
  else if (failedRequests.some((r) => r.failure?.type === 'aborted')) failureType = 'aborted';
  else if (networkFailureCount > 0) failureType = 'network';
  else if (failed) failureType = 'selector';
  else if (run.status === 'error') failureType = 'other';

  // Historical (older-to-newer irrelevant; sort DESC by createdAt).
  const sorted = [...history].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const previousRunCount = sorted.length;
  const previousPassCount = sorted.filter((h) => h.status === 'passed').length;
  const previousFailureCount = previousRunCount - previousPassCount;
  let consecutivePreviousPasses = 0;
  for (const h of sorted) {
    if (h.status === 'passed') consecutivePreviousPasses += 1;
    else break;
  }
  const firstObservedFailure =
    previousRunCount > 0 &&
    previousFailureCount === 0 &&
    (run.status === 'failed' || run.status === 'error');

  return {
    failedStepIndex,
    failureType,
    hasScreenshot,
    hasDom,
    consoleErrorCount,
    pageErrorCount,
    networkFailureCount,
    httpErrorCount,
    http5xxCount,
    http4xxCount,
    previousRunCount,
    previousPassCount,
    previousFailureCount,
    consecutivePreviousPasses,
    firstObservedFailure,
  };
}
