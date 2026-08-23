import type { EvidenceRecord } from '../../db/repositories/evidenceRepo.js';
import type { TestRunRecord, TestRunStepRecord } from '../../db/repositories/testRunRepo.js';
import type { InvestigationReport } from '../investigation/investigationTypes.js';
import {
  categorizeError,
  normalizeConsoleMessage,
  normalizeErrorMessage,
  normalizeSelector,
  normalizeUrlForFingerprint,
} from './normalizers.js';
import type { ErrorSignature, FailureFingerprint } from './intelligenceTypes.js';

export interface BuildFingerprintInput {
  run: TestRunRecord;
  steps: TestRunStepRecord[];
  evidence: EvidenceRecord[];
  investigation: InvestigationReport | null;
}

export function buildFingerprint(input: BuildFingerprintInput): FailureFingerprint {
  const { run, steps, evidence, investigation } = input;

  const failedStep = steps.find((s) => s.status === 'failed');
  const errorSignature = buildErrorSignature(
    failedStep?.error_name ?? run.error_name,
    failedStep?.error_message ?? run.error_message,
  );

  const url = normalizeUrlForFingerprint(evidenceValue(evidence, 'browser_metadata', 'url') ?? null);

  const networkMeta = getMetadata<{
    requests?: Array<{ url?: string; status?: number; failure?: { type?: string; status?: number } }>;
  }>(evidence, 'network');
  const failedRequests = (networkMeta?.requests ?? []).filter((r) => r.failure);
  const httpStatuses = Array.from(
    new Set(
      failedRequests
        .map((r) => r.status ?? r.failure?.status)
        .filter((v): v is number => typeof v === 'number'),
    ),
  );
  const failedRequestPaths = Array.from(
    new Set(
      failedRequests
        .map((r) => (r.url ? normalizeUrlForFingerprint(r.url).path : ''))
        .filter((p) => p.length > 0),
    ),
  );

  const consoleMeta = getMetadata<{ logs?: Array<{ type: string; text: string }> }>(
    evidence,
    'console',
  );
  const consoleErrorSignatures = Array.from(
    new Set(
      (consoleMeta?.logs ?? [])
        .filter((l) => l.type === 'error')
        .map((l) => normalizeConsoleMessage(l.text))
        .filter((s) => s.length > 0),
    ),
  ).slice(0, 5);

  const pageErrMeta = getMetadata<{ errors?: Array<{ name?: string; message?: string }> }>(
    evidence,
    'page_error',
  );
  const pageErrorSignatures = Array.from(
    new Set(
      (pageErrMeta?.errors ?? [])
        .map((e) => normalizeErrorMessage(`${e.name ?? 'Error'} ${e.message ?? ''}`))
        .filter((s) => s.length > 0),
    ),
  ).slice(0, 5);

  const selectorSignature = normalizeSelector(
    extractSelectorFromError(failedStep?.error_message ?? run.error_message),
  );

  const browserMeta = getMetadata<{ name?: string; version?: string }>(
    evidence,
    'browser_metadata',
  );

  const evidenceTypes = Array.from(new Set(evidence.map((e) => e.evidence_type))).sort();

  return {
    testRunId: run.id,
    externalTestId: run.external_test_id,
    testName: run.test_name,
    classification: investigation?.classification ?? 'unknown',
    severity: investigation?.severity ?? 'unknown',
    failedStepIndex: failedStep ? failedStep.step_index : run.error_step_index ?? null,
    actionType: failedStep?.action ?? null,
    errorSignature,
    failureType: null,
    targetUrl: url.full,
    normalizedPath: url.path,
    httpStatuses,
    failedRequestPaths,
    consoleErrorSignatures,
    pageErrorSignatures,
    selectorSignature,
    affectedArea: investigation?.affectedArea ?? null,
    browserName: browserMeta?.name ?? null,
    browserVersion: browserMeta?.version ?? null,
    evidenceTypes,
    investigationId: investigation?.id ?? null,
    startedAt: run.started_at.toISOString(),
    status: run.status === 'error' ? 'error' : 'failed',
  };
}

function buildErrorSignature(name: string | null | undefined, message: string | null | undefined): ErrorSignature {
  const type = (name ?? 'Error').slice(0, 100);
  const normalizedMessage = normalizeErrorMessage(message ?? '');
  const category = categorizeError(name ?? '', message ?? '');
  return { type, normalizedMessage, category };
}

function evidenceValue(
  evidence: EvidenceRecord[],
  type: string,
  key: string,
): string | undefined {
  const rec = evidence.find((e) => e.evidence_type === type);
  const v = (rec?.metadata as Record<string, unknown> | undefined)?.[key];
  return typeof v === 'string' ? v : undefined;
}

function getMetadata<T>(evidence: EvidenceRecord[], type: string): T | undefined {
  const rec = evidence.find((e) => e.evidence_type === type);
  return rec?.metadata as T | undefined;
}

function extractSelectorFromError(msg: string | null | undefined): string | null {
  if (!msg) return null;
  // Extract text inside locator('...') or waiting for '...'.
  const patterns = [
    /locator\(['"](.*?)['"]\)/i,
    /waiting for (?:selector|locator)? ?['"](.*?)['"]/i,
    /selector ['"](.*?)['"]/i,
  ];
  for (const p of patterns) {
    const m = p.exec(msg);
    if (m) return m[1] ?? null;
  }
  return null;
}

export function primaryFailureSignature(fp: FailureFingerprint): string {
  const parts = [
    fp.errorSignature.category,
    fp.normalizedPath || fp.testName,
    fp.failedRequestPaths[0] ?? '',
    fp.errorSignature.normalizedMessage,
    fp.selectorSignature ?? '',
  ];
  return parts.filter((p) => p.length > 0).join(' | ');
}
