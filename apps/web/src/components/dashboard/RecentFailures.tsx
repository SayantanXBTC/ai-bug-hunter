import { useEffect, useState } from 'react';
import { IconChevronRight, IconX } from '../icons.js';
import { formatDuration, formatRelativeTime } from '../../lib/format.js';
import { Skeleton } from './Skeleton.js';

interface RunItem {
  id: string;
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'error' | string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface RecentFailuresProps {
  onOpenRuns: () => void;
  canWrite: boolean;
}

export function RecentFailures({ onOpenRuns, canWrite }: RecentFailuresProps): JSX.Element {
  const [items, setItems] = useState<RunItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Endpoint doesn't support status filter — fetch small page and filter client-side.
        const res = await fetch('/api/test-runs?limit=25', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { items: RunItem[] };
        if (!cancelled) {
          const failed = (body.items ?? [])
            .filter((r) => r.status === 'failed' || r.status === 'error')
            .slice(0, 5);
          setItems(failed);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">Recent Failures</h2>
          <p className="text-xs text-neutral-500">Latest failed and errored runs.</p>
        </div>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load: {error}</div>}
      {!error && items === null && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {!error && items && items.length === 0 && (
        <div className="rounded border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center">
          <p className="text-sm text-neutral-500">No recent failures. Run tests to see results here.</p>
          {canWrite && (
            <button
              type="button"
              onClick={onOpenRuns}
              className="mt-3 inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Run Tests
            </button>
          )}
        </div>
      )}
      {!error && items && items.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {items.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={onOpenRuns}
                className="group flex w-full items-center gap-3 py-2.5 text-left hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
              >
                <span
                  aria-label={r.status}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700"
                >
                  <IconX size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-900">{r.testName || r.testId}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {formatRelativeTime(r.startedAt)} · {formatDuration(r.durationMs ?? 0)}
                  </div>
                </div>
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  {r.status}
                </span>
                <IconChevronRight size={14} className="text-neutral-300 group-hover:text-neutral-500" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
