import { LLMProviderError, type LLMProvider, type LLMRequest, type LLMResponse } from './llmProvider.js';

export type FakeResponder = (req: LLMRequest) => string | Promise<string> | LLMProviderError | Promise<LLMProviderError>;

export class FakeLLMProvider implements LLMProvider {
  readonly name = 'fake';
  readonly supportsImages = true;
  private readonly responder: FakeResponder;

  constructor(responder: FakeResponder) {
    this.responder = responder;
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const result = await this.responder(req);
    if (result instanceof LLMProviderError) throw result;
    return {
      content: result,
      usage: { inputTokens: req.userPrompt.length, outputTokens: result.length },
      provider: this.name,
      model: req.model,
    };
  }
}
