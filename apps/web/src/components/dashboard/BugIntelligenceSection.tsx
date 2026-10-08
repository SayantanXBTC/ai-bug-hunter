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
    <section className="abh-card abh-glow-border flex flex-col p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-strong)]">
            <IconSparkles size={16} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
              <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Bug Intelligence</h2>
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Failures grouped by shared root cause.</p>
          </div>
        </div>
        <button type="button" onClick={onOpenBugs} className="abh-btn abh-btn-ghost abh-btn-sm">
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
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <svg width="90" height="56" viewBox="0 0 90 56" aria-hidden className="abh-float">
            <circle cx="20" cy="28" r="6" fill="var(--primary)" opacity="0.6" />
            <circle cx="45" cy="14" r="4" fill="var(--secondary)" opacity="0.6" />
            <circle cx="70" cy="32" r="7" fill="var(--primary)" opacity="0.4" />
            <path d="M20 28 L45 14 L70 32" stroke="var(--border-strong)" fill="none" strokeDasharray="3 4" />
          </svg>
          <p className="mt-3 text-sm text-[var(--text-muted)]">No bugs detected. Failed tests will be clustered here.</p>
        </div>
      )}
      {!error && items && items.length > 0 && (
        <ul className="abh-stagger space-y-1.5">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={onOpenBugs}
                className="group flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-[var(--border)] hover:bg-[var(--surface-hover)]"
              >
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
                    <span>Last seen {formatRelativeTime(c.lastSeenAt)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                      <div
                        className="abh-grow-x h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        style={{ width: `${Math.round(c.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-[var(--text-subtle)]">
                      {Math.round(c.confidence * 100)}% conf.
                    </span>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${severityPill(c.severity)}`}>
                  {c.severity}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
