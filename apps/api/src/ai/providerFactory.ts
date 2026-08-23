import { env } from '../config/env.js';
import { AnthropicProvider } from './providers/anthropicProvider.js';
import { LLMProviderError, type LLMProvider } from './providers/llmProvider.js';

let cached: LLMProvider | null = null;

export function getConfiguredProvider(): LLMProvider {
  if (cached) return cached;
  if (env.LLM_PROVIDER === 'anthropic') {
    cached = new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
    return cached;
  }
  throw new LLMProviderError(`Unsupported LLM_PROVIDER: ${env.LLM_PROVIDER}`, 'unknown');
}

export function resetProviderCache(): void {
  cached = null;
}
