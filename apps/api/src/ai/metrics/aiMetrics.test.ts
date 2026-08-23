import { describe, it, expect, beforeEach } from 'vitest';
import { recordAiCall, getAiMetricsSnapshot, resetAiMetrics } from './aiMetrics.js';

beforeEach(() => {
  resetAiMetrics();
});

describe('aiMetrics', () => {
  it('aggregates totals and per-operation stats', () => {
    recordAiCall({ provider: 'fake', model: 'm', operation: 'generate', latencyMs: 100, success: true, tokens: 50 });
    recordAiCall({ provider: 'fake', model: 'm', operation: 'generate', latencyMs: 200, success: true, tokens: 70 });
    recordAiCall({ provider: 'fake', model: 'm', operation: 'investigate', latencyMs: 300, success: false });

    const snap = getAiMetricsSnapshot();
    expect(snap.requestCount).toBe(3);
    expect(snap.successCount).toBe(2);
    expect(snap.failureCount).toBe(1);
    expect(snap.totalLatencyMs).toBe(600);
    expect(snap.estimatedTokens).toBe(120);
    expect(snap.byOperation.generate).toEqual({ count: 2, latencyMs: 300, tokens: 120 });
    expect(snap.byOperation.investigate).toEqual({ count: 1, latencyMs: 300, tokens: 0 });
    expect(snap.provider).toBe('fake');
    expect(snap.model).toBe('m');
  });

  it('never exposes any prompt-like fields', () => {
    recordAiCall({ provider: 'fake', model: 'm', operation: 'op', latencyMs: 10, success: true });
    const snap = getAiMetricsSnapshot();
    const s = JSON.stringify(snap).toLowerCase();
    expect(s).not.toContain('prompt');
    expect(s).not.toContain('systemprompt');
    expect(s).not.toContain('userprompt');
    expect(s).not.toContain('content');
  });
});
