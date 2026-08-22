import { useEffect, useState } from 'react';
import { isHealthResponse, type HealthStatus } from '@ai-bug-hunter/shared';

export interface HealthState {
  status: HealthStatus | 'loading';
}

export function useHealth(pollMs = 15_000): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const check = async (): Promise<void> => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body: unknown = await res.json();
        if (!cancelled && isHealthResponse(body)) {
          setState({ status: body.status });
        } else if (!cancelled) {
          setState({ status: 'error' });
        }
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    };

    void check();
    const id = setInterval(() => void check(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return state;
}
