import { env as defaultEnv } from '../config/env.js';
import type { AppEnv } from '../config/env.js';
import { AnthropicProvider } from './providers/anthropicProvider.js';
import { FakeLLMProvider, defaultFallbackResponder } from './providers/fakeLLMProvider.js';
import { LLMProviderError, type LLMProvider } from './providers/llmProvider.js';

let cached: LLMProvider | null = null;
let warnedFallback = false;
let warnedDisabled = false;

export function getConfiguredProvider(envOverride?: AppEnv): LLMProvider {
  if (cached) return cached;
  const env = envOverride ?? defaultEnv;

  if (!env.LLM_ENABLED) {
    if (!warnedDisabled) {
      console.warn('[ai] LLM_ENABLED=false — using FakeLLMProvider (no external calls)');
      warnedDisabled = true;
    }
    cached = new FakeLLMProvider(defaultFallbackResponder);
    return cached;
  }

  if (env.LLM_PROVIDER === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY.trim() === '') {
      if (!warnedFallback) {
        console.warn(
          '[ai] LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty — falling back to FakeLLMProvider',
        );
        warnedFallback = true;
      }
      cached = new FakeLLMProvider(defaultFallbackResponder);
      return cached;
    }
    cached = new AnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      timeoutMs: env.LLM_TIMEOUT_MS,
    });
    return cached;
  }

  if (env.LLM_PROVIDER === 'fake') {
    cached = new FakeLLMProvider(defaultFallbackResponder);
    return cached;
  }

  throw new LLMProviderError(`Unsupported LLM_PROVIDER: ${env.LLM_PROVIDER}`, 'unknown');
}

export function resetProviderCache(): void {
  cached = null;
  warnedFallback = false;
  warnedDisabled = false;
}
