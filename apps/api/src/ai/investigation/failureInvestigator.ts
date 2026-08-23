import type { LLMProvider } from '../providers/llmProvider.js';
import { LLMProviderError } from '../providers/llmProvider.js';
import { logger } from '@ai-bug-hunter/test-engine';
import type { TestRunRecord, TestRunStepRecord } from '../../db/repositories/testRunRepo.js';
import type { EvidenceRecord, ArtifactRecord } from '../../db/repositories/evidenceRepo.js';
import { buildInvestigationContext, type HistoricalRunSummary } from './investigationContext.js';
import { computeFailureSignals, type HistoricalMini } from './failureSignals.js';
import { INVESTIGATION_SYSTEM_PROMPT, buildInvestigationUserPrompt } from './investigationPrompt.js';
import { LLMInvestigationSchema } from './investigationSchemas.js';
import { buildValidatedReport } from './investigationValidator.js';
import type { InvestigationReport, InvestigationResponse } from './investigationTypes.js';
import type { ImageEvidenceInput } from '../providers/llmProvider.js';

export interface FailureInvestigatorOptions {
  provider: LLMProvider;
  model: string;
  promptMaxChars?: number;
}

export interface InvestigateInput {
  run: TestRunRecord;
  steps: TestRunStepRecord[];
  evidence: EvidenceRecord[];
  artifactsById: Map<string, ArtifactRecord>;
  historicalRuns: TestRunRecord[];
  domText?: string;
  screenshot?: ImageEvidenceInput;
}

export class FailureInvestigator {
  private readonly provider: LLMProvider;
  private readonly model: string;
  private readonly promptMaxChars: number;

  constructor(opts: FailureInvestigatorOptions) {
    this.provider = opts.provider;
    this.model = opts.model;
    this.promptMaxChars = opts.promptMaxChars ?? 40_000;
  }

  async investigate(input: InvestigateInput): Promise<InvestigationResponse> {
    const startedMs = Date.now();

    if (input.run.status === 'passed') {
      return { status: 'not_investigable', message: 'Investigation is available for failed or errored runs.' };
    }

    const historyForSignals: HistoricalMini[] = input.historicalRuns.map((h) => ({
      status: h.status,
      createdAt: h.created_at,
    }));
    const signals = computeFailureSignals(input.run, input.steps, input.evidence, historyForSignals);

    const historicalSummary: HistoricalRunSummary[] = input.historicalRuns.map((h) => {
      const item: HistoricalRunSummary = {
        id: h.id,
        status: h.status,
        startedAt: h.started_at.toISOString(),
        durationMs: h.duration_ms,
      };
      if (h.error_message) item.errorMessage = h.error_message;
      return item;
    });

    const bundle = buildInvestigationContext({
      run: input.run,
      steps: input.steps,
      evidence: input.evidence,
      artifactsById: input.artifactsById,
      ...(input.domText ? { domText: input.domText } : {}),
      ...(input.screenshot && this.provider.supportsImages ? { screenshot: input.screenshot } : {}),
      history: historicalSummary,
      signals,
    });

    const userPrompt = buildInvestigationUserPrompt(bundle.view);
    if (userPrompt.length > this.promptMaxChars) {
      return failure('validation_error', `Prompt too large (${userPrompt.length} > ${this.promptMaxChars})`, startedMs);
    }

    logger.info('investigation:start', {
      testRunId: input.run.id,
      provider: this.provider.name,
      model: this.model,
      evidenceCount: input.evidence.length,
      historicalRunCount: input.historicalRuns.length,
    });

    let raw: string;
    try {
      const res = await this.provider.generate({
        systemPrompt: INVESTIGATION_SYSTEM_PROMPT,
        userPrompt,
        model: this.model,
        images: bundle.images,
      });
      raw = res.content;
    } catch (err) {
      logger.warn('investigation:provider-error', {
        testRunId: input.run.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return { status: 'provider_error', message: friendlyProviderMessage(err) };
    }

    const parsed = safeParseJson(raw);
    if (!parsed.ok) {
      return failure('validation_error', 'Model output was not valid JSON', startedMs);
    }
    const schemaCheck = LLMInvestigationSchema.safeParse(parsed.value);
    if (!schemaCheck.success) {
      const detail = schemaCheck.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return failure('validation_error', `Schema validation failed: ${detail}`, startedMs);
    }

    const report: InvestigationReport = buildValidatedReport({
      raw: schemaCheck.data,
      bundle,
      testRunId: input.run.id,
      provider: this.provider.name,
      model: this.model,
      durationMs: Date.now() - startedMs,
      testSteps: input.steps.map((s) => ({ index: s.step_index, action: s.action })),
    });

    logger.info('investigation:complete', {
      testRunId: input.run.id,
      classification: report.classification,
      confidence: report.confidence,
      warnings: report.validationWarnings.length,
      durationMs: report.durationMs,
    });

    return { status: 'ok', report };
  }
}

function friendlyProviderMessage(err: unknown): string {
  if (err instanceof LLMProviderError) {
    switch (err.kind) {
      case 'missing_api_key':
        return 'AI investigation is not configured on the server.';
      case 'rate_limit':
        return 'AI provider rate-limited the request. Please retry shortly.';
      case 'network':
        return 'AI provider is temporarily unavailable.';
      case 'invalid_response':
        return 'AI provider returned an unexpected response.';
      default:
        return 'AI investigation is temporarily unavailable.';
    }
  }
  return 'AI investigation is temporarily unavailable.';
}

function failure(
  status: InvestigationResponse['status'],
  message: string,
  _startedMs: number,
): InvestigationResponse {
  return { status, message };
}

function safeParseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const cleaned = stripCodeFences(raw).trim();
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function stripCodeFences(s: string): string {
  const m = s.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1]! : s;
}
