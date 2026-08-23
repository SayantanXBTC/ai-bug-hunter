/**
 * Gated live-call test for AnthropicProvider.
 *
 * Skips unless `ANTHROPIC_API_KEY` is set in the environment. Never prints the
 * key, never asserts on its contents, and does not include any credential in
 * the file. Uses a small prompt to keep cost minimal.
 *
 * Run locally with:
 *   $env:ANTHROPIC_API_KEY = "..."; npx vitest run apps/api/src/ai/providers/anthropicProvider.live.test.ts
 */
import { describe, expect, it } from 'vitest';
import { AnthropicProvider } from './anthropicProvider.js';
import { getAiMetricsSnapshot } from '../metrics/aiMetrics.js';

const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const MODEL = process.env.LLM_MODEL ?? 'claude-sonnet-4-6';

describe.skipIf(!hasKey)('AnthropicProvider (live)', () => {
  it(
    'responds to a small prompt without leaking the API key',
    async () => {
      const key = process.env.ANTHROPIC_API_KEY ?? '';
      const provider = new AnthropicProvider({ apiKey: key, timeoutMs: 15_000 });

      const res = await provider.generate({
        systemPrompt: 'You are a test. Reply with the exact text requested and nothing else.',
        userPrompt: 'Reply with exactly: OK',
        model: MODEL,
        maxOutputTokens: 8,
        operation: 'live_smoke_test',
      });

      expect(res.content.length).toBeGreaterThan(0);

      const snapshotStr = JSON.stringify(getAiMetricsSnapshot());
      // Never log or assert the actual key. Only assert absence.
      if (key.length > 8) {
        expect(snapshotStr.includes(key)).toBe(false);
      }
    },
    20_000,
  );
});
