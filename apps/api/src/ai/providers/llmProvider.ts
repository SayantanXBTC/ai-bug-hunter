export interface ImageEvidenceInput {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  data: string; // base64
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxOutputTokens?: number;
  images?: ImageEvidenceInput[];
}

export interface LLMResponse {
  content: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  provider: string;
  model: string;
}

export interface LLMProvider {
  readonly name: string;
  readonly supportsImages: boolean;
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
