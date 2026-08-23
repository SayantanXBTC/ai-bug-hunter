import { useEffect, useState } from 'react';
import { IconSparkles, IconChevronRight } from '../icons.js';
import { formatRelativeTime } from '../../lib/format.js';
import { Skeleton } from './Skeleton.js';

interface ClusterItem {
  id: string;
  title: string | null;
  severity: string;
  status: string;
  regressionStatus: string;
  confidence: number;
  occurrenceCount: number;
  lastSeenAt: string;
  primaryFailureSignature?: string | null;
}

function severityPill(sev: string): string {
  switch (sev) {
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'high':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'medium':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'low':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-muted)]';
  }
}

interface BugIntelligenceSectionProps {
  onOpenBugs: () => void;
}

export function BugIntelligenceSection({ onOpenBugs }: BugIntelligenceSectionProps): JSX.Element {
  const [items, setItems] = useState<ClusterItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/bug-intelligence/clusters?limit=5', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { items: ClusterItem[] };
        if (!cancelled) setItems(body.items ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-lg border border-violet-100 bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Bug Intelligence</h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)] flex items-center gap-1">
            <IconSparkles size={12} className="text-violet-500" /> AI-clustered defects from recent failures
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenBugs}
          className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
          View all <IconChevronRight size={12} />
        </button>
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
        <div className="rounded border border-dashed border-[var(--border)] bg-[var(--surface-hover)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          No bugs detected. Failed tests will be clustered here.
        </div>
      )}
      {!error && items && items.length > 0 && (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((c) => (
            <li key={c.id} className="py-2.5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--text)]">
                      {c.title || c.primaryFailureSignature || 'Untitled cluster'}
                    </span>
                    {c.regressionStatus === 'regressed' && (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                        Regressed
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{c.occurrenceCount} occurrence{c.occurrenceCount === 1 ? '' : 's'}</span>
                    <span aria-hidden>·</span>
                    <span>Confidence {Math.round(c.confidence * 100)}%</span>
                    <span aria-hidden>·</span>
                    <span>Last seen {formatRelativeTime(c.lastSeenAt)}</span>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${severityPill(c.severity)}`}>
                  {c.severity}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
