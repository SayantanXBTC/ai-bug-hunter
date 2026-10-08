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
    <section className="abh-card flex flex-col p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
            <IconX size={16} />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Recent Failures</h2>
            <p className="text-xs text-[var(--text-muted)]">Latest failed and errored runs. Click one to inspect it.</p>
          </div>
        </div>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load: {error}</div>}
      {!error && items === null && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {!error && items && items.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <span className="abh-float flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-soft)] text-2xl text-[var(--success)]">
            ✓
          </span>
          <p className="mt-3 text-sm font-medium text-[var(--text)]">No recent failures</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Failed runs show up here the moment they happen.</p>
          {canWrite && (
            <button type="button" onClick={onOpenRuns} className="abh-btn abh-btn-ghost abh-btn-sm mt-4">
              Run Tests
            </button>
          )}
        </div>
      )}
      {!error && items && items.length > 0 && (
        <ul className="abh-stagger space-y-1.5">
          {items.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={onOpenRuns}
                className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-[var(--border)] hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <span
                  aria-label={r.status}
                  className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]"
                >
                  <span className="absolute inset-0 animate-ping rounded-full bg-[var(--danger)] opacity-10" />
                  <IconX size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--text)]">{r.testName || r.testId}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {formatRelativeTime(r.startedAt)} · {formatDuration(r.durationMs ?? 0)}
                  </div>
                </div>
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                  {r.status}
                </span>
                <IconChevronRight size={14} className="text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text-muted)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
