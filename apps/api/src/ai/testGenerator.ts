import {
  assertSafeUrl,
  isInScope,
  tryParseUrl,
  type ApplicationModel,
  type TestAction,
  type TestDefinition,
} from '@ai-bug-hunter/test-engine';
import { assertTargetUrlAllowed, TargetUrlError } from '../security/targetUrlPolicy.js';
import { logger } from '@ai-bug-hunter/test-engine';
import { LLMProviderError, type LLMProvider } from './providers/llmProvider.js';
import {
  GeneratedTestSuiteSchema,
  type GeneratedTest,
  type GeneratedTestSuite,
} from './schemas/aiTestResponse.js';
import {
  compactApplicationModel,
  DEFAULT_COMPACTION_LIMITS,
  type CompactionLimits,
} from './modelCompactor.js';
import { SUPPORTED_ACTIONS, SYSTEM_PROMPT, buildUserPrompt } from './prompts/testGenerationPrompt.js';
import type {
  TestGenerationInput,
  TestGenerationOutput,
  TestValidationIssue,
  ValidatedGeneratedTest,
} from './aiTypes.js';

export interface TestGeneratorOptions {
  provider: LLMProvider;
  model: string;
  maxTestsCap: number;
  compactionLimits?: CompactionLimits;
  promptMaxChars?: number;
}

export class TestGenerator {
  private readonly provider: LLMProvider;
  private readonly model: string;
  private readonly maxTestsCap: number;
  private readonly compaction: CompactionLimits;
  private readonly promptMaxChars: number;

  constructor(opts: TestGeneratorOptions) {
    this.provider = opts.provider;
    this.model = opts.model;
    this.maxTestsCap = opts.maxTestsCap;
    this.compaction = opts.compactionLimits ?? DEFAULT_COMPACTION_LIMITS;
    this.promptMaxChars = opts.promptMaxChars ?? this.compaction.maxPromptChars;
  }

  async generate(input: TestGenerationInput): Promise<TestGenerationOutput> {
    const startedMs = Date.now();
    const cappedMaxTests = Math.min(input.maxTests ?? this.maxTestsCap, this.maxTestsCap);
    const context = compactApplicationModel(
      input.applicationModel,
      this.compaction,
      input.targetPage,
    );
    const userPrompt = buildUserPrompt({
      goal: input.goal,
      maxTests: cappedMaxTests,
      ...(input.targetPage ? { targetPage: input.targetPage } : {}),
      ...(input.categories ? { categories: input.categories } : {}),
      context,
    });

    if (userPrompt.length > this.promptMaxChars) {
      return failure(
        'validation_error',
        `Prompt too large (${userPrompt.length} > ${this.promptMaxChars}); reduce discovery scope`,
        startedMs,
        this.provider.name,
        this.model,
      );
    }

    logger.info('ai:generate-start', {
      provider: this.provider.name,
      model: this.model,
      goal: input.goal,
      maxTests: cappedMaxTests,
      contextChars: userPrompt.length,
    });

    let raw: string;
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    try {
      const res = await this.provider.generate({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        model: this.model,
      });
      raw = res.content;
      usage = res.usage;
    } catch (err) {
      const message = err instanceof LLMProviderError ? err.message : 'Unknown provider error';
      logger.warn('ai:provider-error', { provider: this.provider.name, error: message });
      return {
        status: 'provider_error',
        tests: [],
        warnings: [],
        provider: this.provider.name,
        model: this.model,
        durationMs: Date.now() - startedMs,
        message: friendlyProviderMessage(err),
      };
    }

    const parsed = safeParseJson(raw);
    if (!parsed.ok) {
      logger.warn('ai:parse-error', { error: parsed.error });
      return failure('validation_error', 'Model output was not valid JSON', startedMs, this.provider.name, this.model);
    }

    const schemaCheck = GeneratedTestSuiteSchema.safeParse(parsed.value);
    if (!schemaCheck.success) {
      const detail = schemaCheck.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      logger.warn('ai:schema-error', { detail });
      return failure('validation_error', `Schema validation failed: ${detail}`, startedMs, this.provider.name, this.model);
    }

    const validated = validateSuite(schemaCheck.data, input.applicationModel, cappedMaxTests);

    const out: TestGenerationOutput = {
      status: 'success',
      tests: validated.tests,
      warnings: validated.warnings,
      provider: this.provider.name,
      model: this.model,
      durationMs: Date.now() - startedMs,
    };
    if (usage) out.usage = usage;

    logger.info('ai:generate-complete', {
      provider: this.provider.name,
      model: this.model,
      count: validated.tests.length,
      validCount: validated.tests.filter((t) => t.validationStatus === 'valid').length,
      warnings: validated.warnings.length,
      durationMs: out.durationMs,
    });

    return out;
  }
}

function friendlyProviderMessage(err: unknown): string {
  if (err instanceof LLMProviderError) {
    switch (err.kind) {
      case 'missing_api_key':
        return 'AI test generation is not configured on the server.';
      case 'rate_limit':
        return 'AI provider rate-limited the request. Please retry shortly.';
      case 'network':
        return 'AI provider is temporarily unavailable.';
      case 'invalid_response':
        return 'AI provider returned an unexpected response.';
      default:
        return 'AI test generation is temporarily unavailable.';
    }
  }
  return 'AI test generation is temporarily unavailable.';
}

function failure(
  status: TestGenerationOutput['status'],
  message: string,
  startedMs: number,
  provider: string,
  model: string,
): TestGenerationOutput {
  return {
    status,
    tests: [],
    warnings: [],
    provider,
    model,
    durationMs: Date.now() - startedMs,
    message,
  };
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
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const m = s.trim().match(fence);
  return m ? m[1]! : s;
}

function collectKnownSelectors(model: ApplicationModel): Set<string> {
  const set = new Set<string>();
  for (const p of model.pages) {
    for (const e of p.elements) for (const s of e.selectors) set.add(s.value);
    for (const f of p.forms) {
      for (const s of f.selectors) set.add(s.value);
      for (const s of f.submitSelectors) set.add(s.value);
      for (const fd of f.fields) for (const s of fd.selectors) set.add(s.value);
    }
    for (const l of p.links) for (const s of l.selectors) set.add(s.value);
  }
  return set;
}

function collectKnownUrls(model: ApplicationModel): Set<string> {
  const set = new Set<string>();
  for (const p of model.pages) set.add(p.url);
  return set;
}

interface ValidationBundle {
  tests: ValidatedGeneratedTest[];
  warnings: string[];
}

function validateSuite(
  suite: GeneratedTestSuite,
  model: ApplicationModel,
  maxTests: number,
): ValidationBundle {
  const warnings: string[] = [];
  const knownSelectors = collectKnownSelectors(model);
  const knownUrls = collectKnownUrls(model);
  const baseUrl = tryParseUrl(model.baseUrl);
  if (!baseUrl) return { tests: [], warnings: ['ApplicationModel has invalid baseUrl'] };

  const seenSignatures = new Set<string>();
  const tests: ValidatedGeneratedTest[] = [];

  const capped = suite.tests.slice(0, maxTests);
  if (suite.tests.length > maxTests) {
    warnings.push(`Model returned ${suite.tests.length} tests; truncated to ${maxTests}`);
  }

  for (const t of capped) {
    const issues: TestValidationIssue[] = [];

    validateUrl(t.targetUrl, baseUrl, knownUrls, model, issues, undefined);

    t.steps.forEach((step, i) => {
      if (!SUPPORTED_ACTIONS.includes(step.action as (typeof SUPPORTED_ACTIONS)[number])) {
        issues.push({
          kind: 'unsupported_action',
          message: `Step ${i} uses unsupported action`,
          action: (step as { action: string }).action,
        });
        return;
      }
      if (step.action === 'navigate') {
        validateUrl(step.url, baseUrl, knownUrls, model, issues, i);
        return;
      }
      const selector = extractSelector(step);
      if (selector && !knownSelectors.has(selector)) {
        issues.push({
          kind: 'invented_selector',
          message: `Selector not present in ApplicationModel`,
          selector,
          stepIndex: i,
        });
      }
    });

    const signature = signatureFor(t);
    if (seenSignatures.has(signature)) {
      issues.push({ kind: 'duplicate_test', message: 'Duplicate of an earlier generated test' });
    }
    seenSignatures.add(signature);

    const testDef: TestDefinition = {
      id: t.id,
      name: t.name,
      targetUrl: t.targetUrl,
      steps: t.steps as TestAction[],
    };
    const validated: ValidatedGeneratedTest = {
      test: testDef,
      validationStatus: issues.length === 0 ? 'valid' : 'invalid',
      issues,
      ...(t.description ? { description: t.description } : {}),
      ...(t.category ? { category: t.category } : {}),
    };
    tests.push(validated);
  }

  return { tests, warnings };
}

function extractSelector(step: TestAction): string | undefined {
  if ('selector' in step) return step.selector;
  return undefined;
}

function validateUrl(
  raw: string,
  baseUrl: URL,
  knownUrls: Set<string>,
  model: ApplicationModel,
  issues: TestValidationIssue[],
  stepIndex: number | undefined,
): void {
  try {
    assertSafeUrl(raw);
    // If the discovered baseUrl itself is private (e.g. tests hitting loopback),
    // allow private targets for generated URLs too — otherwise every test would
    // fail validation against a local fixture. External baseUrls stay strict.
    const baseIsPrivate = isPrivateHost(baseUrl.hostname);
    assertTargetUrlAllowed(raw, { allowPrivate: baseIsPrivate });
  } catch (err) {
    if (err instanceof TargetUrlError) {
      const issue: TestValidationIssue = {
        kind: 'invalid_url',
        message: `${err.code}: ${err.message}`,
        url: raw,
        ...(stepIndex !== undefined ? { stepIndex } : {}),
      };
      issues.push(issue);
      return;
    }
    const issue: TestValidationIssue = {
      kind: 'invalid_url',
      message: err instanceof Error ? err.message : 'invalid URL',
      url: raw,
      ...(stepIndex !== undefined ? { stepIndex } : {}),
    };
    issues.push(issue);
    return;
  }
  const parsed = tryParseUrl(raw);
  if (!parsed) {
    const issue: TestValidationIssue = {
      kind: 'invalid_url',
      message: 'invalid URL',
      url: raw,
      ...(stepIndex !== undefined ? { stepIndex } : {}),
    };
    issues.push(issue);
    return;
  }
  if (!isInScope(parsed, { baseUrl, sameOriginOnly: true, allowedHosts: [] })) {
    const issue: TestValidationIssue = {
      kind: 'out_of_scope_url',
      message: 'URL is out of discovered application scope',
      url: raw,
      ...(stepIndex !== undefined ? { stepIndex } : {}),
    };
    issues.push(issue);
    return;
  }
  // Not a hard rejection when URL is not in enumerated pages — same-origin is enough for safety,
  // but warn via issue for URLs that are not part of the discovered surface.
  if (!knownUrls.has(raw) && !knownUrls.has(parsed.toString()) && model.pages.length > 0) {
    // Soft note as a warning-style issue with invalid_url kind is too strong;
    // we accept same-origin URLs that weren't crawled (e.g. a link discovered on a page).
  }
}

function isPrivateHost(host: string): boolean {
  if (host === 'localhost' || host === '0.0.0.0') return true;
  // IPv4 dotted-quad in private-ish ranges.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    return true;
  }
  return false;
}

function signatureFor(t: GeneratedTest): string {
  return JSON.stringify({
    targetUrl: t.targetUrl,
    steps: t.steps,
  });
}
