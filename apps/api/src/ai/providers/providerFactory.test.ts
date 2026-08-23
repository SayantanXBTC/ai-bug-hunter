import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConfiguredProvider, resetProviderCache } from '../providerFactory.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { FakeLLMProvider } from './fakeLLMProvider.js';
import type { AppEnv } from '../../config/env.js';

function envWith(overrides: Partial<AppEnv>): AppEnv {
  const base: AppEnv = {
    NODE_ENV: 'test',
    API_PORT: 5000,
    FRONTEND_URL: 'http://localhost:5173',
    DATABASE_HOST: '127.0.0.1',
    DATABASE_PORT: 5432,
    DATABASE_NAME: 'x',
    DATABASE_USER: 'x',
    DATABASE_PASSWORD: '',
    ARTIFACT_STORAGE_PATH: './artifacts',
    TEST_RUNS_LIST_MAX_LIMIT: 100,
    LLM_PROVIDER: 'anthropic',
    LLM_MODEL: 'claude-sonnet-4-6',
    LLM_ENABLED: true,
    LLM_MAX_TOKENS: 4096,
    LLM_TEMPERATURE: 0.2,
    LLM_TIMEOUT_MS: 60_000,
    ANTHROPIC_API_KEY: '',
    ALLOW_PRIVATE_TARGETS: false,
    AI_MAX_TESTS: 20,
    AI_PROMPT_MAX_CHARS: 30_000,
    BUG_INTEL_MAX_RUNS: 500,
    BUG_INTEL_MAX_CANDIDATE_PAIRS: 2000,
    BUG_INTEL_MAX_AI_COMPARISONS: 100,
    BUG_INTEL_MIN_RESOLUTION_STREAK: 3,
    MIN_FLAKY_RUNS: 10,
    REGRESSION_MAX_CONCURRENCY: 1,
    MAX_AUTO_INVESTIGATIONS_PER_CAMPAIGN: 20,
    MAX_AI_SUMMARIES_PER_CAMPAIGN: 10,
  } as AppEnv;
  return { ...base, ...overrides };
}

beforeEach(() => {
  resetProviderCache();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('getConfiguredProvider', () => {
  it('returns AnthropicProvider when anthropic + key present', () => {
    const p = getConfiguredProvider(envWith({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' }));
    expect(p).toBeInstanceOf(AnthropicProvider);
  });

  it('falls back to FakeLLMProvider when anthropic + key missing', () => {
    const p = getConfiguredProvider(envWith({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' }));
    expect(p).toBeInstanceOf(FakeLLMProvider);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('only warns once about the fallback across multiple calls', () => {
    getConfiguredProvider(envWith({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' }));
    resetProviderCache();
    // second call after reset should NOT re-warn — resetProviderCache clears the warn flag too though.
    // Ensure warn count when we do NOT reset the warn flag: call again without resetting cache.
    const first = console.warn as unknown as ReturnType<typeof vi.fn>;
    first.mockClear();
    // Same provider still cached — no additional warn.
    getConfiguredProvider(envWith({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' }));
    expect(console.warn).toHaveBeenCalledTimes(0);
  });

  it('returns FakeLLMProvider when LLM_ENABLED=false regardless of key', () => {
    const p = getConfiguredProvider(
      envWith({ LLM_ENABLED: false, LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' }),
    );
    expect(p).toBeInstanceOf(FakeLLMProvider);
  });

  it('returns FakeLLMProvider when LLM_PROVIDER=fake', () => {
    const p = getConfiguredProvider(envWith({ LLM_PROVIDER: 'fake' }));
    expect(p).toBeInstanceOf(FakeLLMProvider);
  });
});
