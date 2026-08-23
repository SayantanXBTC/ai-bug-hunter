export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxOutputTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  provider: string;
  model: string;
}

export interface LLMProvider {
  readonly name: string;
  generate(req: LLMRequest): Promise<LLMResponse>;
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | 'missing_api_key'
      | 'network'
      | 'rate_limit'
      | 'invalid_response'
      | 'unknown',
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}
