import Anthropic from '@anthropic-ai/sdk';
import { LLMProviderError, type LLMProvider, type LLMRequest, type LLMResponse } from './llmProvider.js';

export interface AnthropicProviderOptions {
  apiKey: string;
  timeoutMs?: number;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly supportsImages = true;
  private readonly client: Anthropic;

  constructor(opts: AnthropicProviderOptions) {
    if (!opts.apiKey || opts.apiKey.trim() === '') {
      throw new LLMProviderError('ANTHROPIC_API_KEY is not configured', 'missing_api_key');
    }
    this.client = new Anthropic({ apiKey: opts.apiKey, timeout: opts.timeoutMs ?? 60_000 });
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const content: Array<
      | { type: 'text'; text: string }
      | {
          type: 'image';
          source: {
            type: 'base64';
            media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
            data: string;
          };
        }
    > = [];
    for (const img of req.images ?? []) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.data },
      });
    }
    content.push({ type: 'text', text: req.userPrompt });

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: req.model,
        max_tokens: req.maxOutputTokens ?? 4096,
        system: req.systemPrompt,
        messages: [{ role: 'user', content }],
      });
    } catch (err) {
      throw classify(err);
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((b) => b.text)
      .join('\n');

    if (!text) {
      throw new LLMProviderError('Empty response from provider', 'invalid_response');
    }

    return {
      content: text,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
      provider: this.name,
      model: response.model,
    };
  }
}

function classify(err: unknown): LLMProviderError {
  if (err instanceof LLMProviderError) return err;
  if (err instanceof Anthropic.APIError) {
    if (err.status === 401) return new LLMProviderError('Authentication failed', 'missing_api_key');
    if (err.status === 429) return new LLMProviderError('Rate limited', 'rate_limit');
    if (err.status && err.status >= 500)
      return new LLMProviderError(`Upstream error ${err.status}`, 'network');
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new LLMProviderError(msg, 'unknown');
}
