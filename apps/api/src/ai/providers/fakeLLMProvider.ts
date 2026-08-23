import { LLMProviderError, type LLMProvider, type LLMRequest, type LLMResponse } from './llmProvider.js';
import { recordAiCall } from '../metrics/aiMetrics.js';

export type FakeResponder = (req: LLMRequest) => string | Promise<string> | LLMProviderError | Promise<LLMProviderError>;

export class FakeLLMProvider implements LLMProvider {
  readonly name = 'fake';
  readonly supportsImages = true;
  private readonly responder: FakeResponder;

  constructor(responder: FakeResponder) {
    this.responder = responder;
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const operation = req.operation ?? 'generate';
    const started = Date.now();
    let result: string | LLMProviderError;
    try {
      result = await this.responder(req);
    } catch (err) {
      recordAiCall({
        provider: this.name,
        model: req.model,
        operation,
        latencyMs: Date.now() - started,
        success: false,
        tokens: undefined,
      });
      throw err;
    }
    if (result instanceof LLMProviderError) {
      recordAiCall({
        provider: this.name,
        model: req.model,
        operation,
        latencyMs: Date.now() - started,
        success: false,
        tokens: undefined,
      });
      throw result;
    }
    recordAiCall({
      provider: this.name,
      model: req.model,
      operation,
      latencyMs: Date.now() - started,
      success: true,
      tokens: undefined,
    });
    return {
      content: result,
      usage: { inputTokens: req.userPrompt.length, outputTokens: result.length },
      provider: this.name,
      model: req.model,
    };
  }
}

/**
 * Default responder used when the platform falls back to a fake provider
 * (missing API key or LLM_ENABLED=false). Returns a minimal, safe JSON payload
 * that satisfies downstream schema validation for common operations.
 */
export function defaultFallbackResponder(_req: LLMRequest): string {
  return JSON.stringify({ tests: [] });
}
