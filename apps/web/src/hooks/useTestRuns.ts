import { useEffect, useState } from 'react';

export interface TestRunSummary {
  id: string;
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'error';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  createdAt: string;
}

export interface TestRunListResponse {
  items: TestRunSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface StepDetail {
  index: number;
  action: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: { name: string; message: string };
}

export interface EvidenceDetail {
  id: string;
  type: 'screenshot' | 'dom' | 'console' | 'page_error' | 'network' | 'browser_metadata';
  stepId?: string | null;
  metadata: Record<string, unknown>;
  artifactId?: string;
  contentType?: string;
  byteSize?: number;
  sha256?: string;
  downloadUrl?: string;
}

export interface TestRunDetail extends TestRunSummary {
  error?: { name: string | null; message: string | null; stepIndex: number | null };
  steps: StepDetail[];
  evidence: EvidenceDetail[];
}

export function useTestRuns(page = 1, limit = 20): {
  data: TestRunListResponse | null;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<TestRunListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/test-runs?page=${page}&limit=${limit}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: TestRunListResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'unknown error');
      });
    return () => {
      cancelled = true;
    };
  }, [page, limit, tick]);

  return { data, error, refresh: () => setTick((t) => t + 1) };
}

export function useTestRun(id: string | null): { data: TestRunDetail | null; error: string | null } {
  const [data, setData] = useState<TestRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setData(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/test-runs/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: TestRunDetail) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'unknown');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { data, error };
}
