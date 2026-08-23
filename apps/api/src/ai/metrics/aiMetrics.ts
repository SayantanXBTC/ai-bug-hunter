// In-memory AI call metrics. Never records prompts, responses, or PII.

export interface AiCallRecord {
  provider: string;
  model: string;
  operation: string;
  latencyMs: number;
  success: boolean;
  tokens?: number | undefined;
}

interface OperationStats {
  count: number;
  latencyMs: number;
  tokens: number;
}

interface MetricsState {
  provider: string | null;
  model: string | null;
  requestCount: number;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  estimatedTokens: number;
  byOperation: Map<string, OperationStats>;
}

const state: MetricsState = {
  provider: null,
  model: null,
  requestCount: 0,
  successCount: 0,
  failureCount: 0,
  totalLatencyMs: 0,
  estimatedTokens: 0,
  byOperation: new Map(),
};

export function recordAiCall(rec: AiCallRecord): void {
  state.provider = rec.provider;
  state.model = rec.model;
  state.requestCount += 1;
  if (rec.success) state.successCount += 1;
  else state.failureCount += 1;
  state.totalLatencyMs += rec.latencyMs;
  const tokens = rec.tokens ?? 0;
  state.estimatedTokens += tokens;
  const existing = state.byOperation.get(rec.operation) ?? {
    count: 0,
    latencyMs: 0,
    tokens: 0,
  };
  existing.count += 1;
  existing.latencyMs += rec.latencyMs;
  existing.tokens += tokens;
  state.byOperation.set(rec.operation, existing);
}

export interface AiMetricsSnapshot {
  provider: string | null;
  model: string | null;
  requestCount: number;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  estimatedTokens: number;
  byOperation: Record<string, OperationStats>;
}

export function getAiMetricsSnapshot(): AiMetricsSnapshot {
  const byOperation: Record<string, OperationStats> = {};
  for (const [k, v] of state.byOperation.entries()) {
    byOperation[k] = { count: v.count, latencyMs: v.latencyMs, tokens: v.tokens };
  }
  return {
    provider: state.provider,
    model: state.model,
    requestCount: state.requestCount,
    successCount: state.successCount,
    failureCount: state.failureCount,
    totalLatencyMs: state.totalLatencyMs,
    estimatedTokens: state.estimatedTokens,
    byOperation,
  };
}

export function resetAiMetrics(): void {
  state.provider = null;
  state.model = null;
  state.requestCount = 0;
  state.successCount = 0;
  state.failureCount = 0;
  state.totalLatencyMs = 0;
  state.estimatedTokens = 0;
  state.byOperation.clear();
}
