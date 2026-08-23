export const API_SERVICE_NAME = 'ai-bug-hunter-api' as const;

export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthResponse {
  status: HealthStatus;
  service: typeof API_SERVICE_NAME;
}

export interface DetailedHealthResponse extends HealthResponse {
  database: {
    reachable: boolean;
    latencyMs: number | null;
  };
  uptimeSeconds: number;
  timestamp: string;
  llmProvider?: {
    status: 'configured' | 'fake_fallback' | 'disabled' | 'error';
  };
  artifactStorage?: {
    ok: boolean;
  };
  browserAvailable?: 'yes' | 'no' | 'unknown';
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.status === 'ok' || v.status === 'degraded' || v.status === 'error') &&
    v.service === API_SERVICE_NAME
  );
}
