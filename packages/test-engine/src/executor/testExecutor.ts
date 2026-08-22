import { BrowserManager } from '../browser/browserManager.js';
import { executeAction } from '../actions/actionExecutor.js';
import { EvidenceCollector } from '../evidence/evidenceCollector.js';
import {
  DEFAULT_EVIDENCE_OPTIONS,
  type EvidenceOptions,
  type EvidencePackage,
} from '../evidence/evidenceTypes.js';
import { logger } from '../logger.js';
import {
  DEFAULT_EXECUTION_OPTIONS,
  type ExecutionOptions,
  type ExecutionResult,
  type NormalizedError,
  type StepResult,
  type TestAction,
  type TestDefinition,
} from '../types/execution.js';

export interface TestExecutorOptions extends ExecutionOptions {
  browserManager?: BrowserManager;
  evidence?: Partial<EvidenceOptions>;
}

export class TestExecutor {
  private readonly opts: Required<ExecutionOptions>;
  private readonly evidenceOpts: EvidenceOptions;
  private readonly externalManager: BrowserManager | undefined;

  constructor(opts: TestExecutorOptions = {}) {
    this.opts = { ...DEFAULT_EXECUTION_OPTIONS, ...stripUndefined(opts) };
    this.evidenceOpts = { ...DEFAULT_EVIDENCE_OPTIONS, ...(opts.evidence ?? {}) };
    this.externalManager = opts.browserManager;
  }

  async run(def: TestDefinition): Promise<ExecutionResult> {
    const startedAt = new Date();
    const startedMs = Date.now();
    const steps: StepResult[] = [];
    let executionError: NormalizedError | undefined;
    let status: ExecutionResult['status'] = 'passed';
    let evidencePackage: EvidencePackage | undefined;

    const manager =
      this.externalManager ??
      new BrowserManager({ browser: this.opts.browser, headless: this.opts.headless });
    const ownManager = this.externalManager === undefined;

    logger.info('test:start', { testId: def.id, testName: def.name, stepCount: def.steps.length });

    let session: Awaited<ReturnType<BrowserManager['createSession']>> | undefined;
    let collector: EvidenceCollector | undefined;

    try {
      await manager.launch();
      session = await manager.createSession();

      collector = new EvidenceCollector(
        {
          testId: def.id,
          browserName: manager.getName(),
          browserVersion: manager.getVersion(),
        },
        this.evidenceOpts,
      );
      await collector.start(session.page);

      const testTimeoutMs = def.timeoutMs ?? this.opts.testTimeoutMs;
      const testDeadline = startedMs + testTimeoutMs;

      for (let i = 0; i < def.steps.length; i += 1) {
        const step = def.steps[i]!;
        if (Date.now() > testDeadline) {
          status = 'failed';
          executionError = {
            name: 'TestTimeoutError',
            message: `Test exceeded ${testTimeoutMs}ms`,
            stepIndex: i,
          };
          steps.push(skippedStep(i, step));
          await safeCollectFailure(collector, i);
          continue;
        }

        const stepStart = Date.now();
        try {
          await executeAction(session.page, step, {
            actionTimeoutMs: this.opts.actionTimeoutMs,
            navigationTimeoutMs: this.opts.navigationTimeoutMs,
          });
          steps.push({
            index: i,
            action: step.action,
            status: 'passed',
            durationMs: Date.now() - stepStart,
          });
        } catch (err) {
          const normalized = normalizeError(err, i);
          steps.push({
            index: i,
            action: step.action,
            status: 'failed',
            durationMs: Date.now() - stepStart,
            error: normalized,
          });
          status = 'failed';
          executionError = normalized;
          logger.warn('step:failed', {
            testId: def.id,
            stepIndex: i,
            action: step.action,
            error: normalized.message,
          });
          await safeCollectFailure(collector, i);
          for (let j = i + 1; j < def.steps.length; j += 1) {
            steps.push(skippedStep(j, def.steps[j]!));
          }
          break;
        }
      }

      if (status === 'passed' && this.evidenceOpts.screenshotOnSuccess) {
        try {
          await collector.collectSuccessEvidence();
        } catch (err) {
          logger.warn('evidence:success-capture-failed', {
            testId: def.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      status = 'error';
      executionError = normalizeError(err);
      logger.error('test:error', { testId: def.id, error: executionError.message });
    } finally {
      if (collector) {
        try {
          evidencePackage = await collector.finalize();
        } catch (err) {
          logger.warn('evidence:finalize-failed', {
            testId: def.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      if (session) await session.close();
      if (ownManager) await manager.close();
    }

    const finishedAt = new Date();
    const includeEvidence =
      evidencePackage !== undefined &&
      (status !== 'passed' || this.evidenceOpts.includeEvidenceOnSuccess);

    const result: ExecutionResult = {
      testId: def.id,
      testName: def.name,
      status,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      steps,
      ...(executionError ? { error: executionError } : {}),
      ...(includeEvidence && evidencePackage ? { evidence: evidencePackage } : {}),
    };

    logger.info('test:complete', {
      testId: def.id,
      status: result.status,
      durationMs: result.durationMs,
      hasEvidence: includeEvidence,
    });

    return result;
  }
}

async function safeCollectFailure(
  collector: EvidenceCollector | undefined,
  stepIndex: number,
): Promise<void> {
  if (!collector) return;
  try {
    await collector.collectFailureEvidence(stepIndex);
  } catch (err) {
    logger.warn('evidence:failure-capture-failed', {
      stepIndex,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function skippedStep(index: number, step: TestAction): StepResult {
  return { index, action: step.action, status: 'skipped', durationMs: 0 };
}

export function normalizeError(err: unknown, stepIndex?: number): NormalizedError {
  if (err instanceof Error) {
    const out: NormalizedError = {
      name: err.name || 'Error',
      message: sanitize(err.message),
    };
    if (stepIndex !== undefined) out.stepIndex = stepIndex;
    return out;
  }
  const out: NormalizedError = { name: 'UnknownError', message: sanitize(String(err)) };
  if (stepIndex !== undefined) out.stepIndex = stepIndex;
  return out;
}

function sanitize(msg: string): string {
  const max = 2000;
  return msg.length > max ? msg.slice(0, max) + '…' : msg;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
