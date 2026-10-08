import { useEffect, useState } from 'react';
import { IconPaperclip } from '../icons.js';
import { formatDuration, formatRelativeTime } from '../../lib/format.js';
import { Skeleton } from './Skeleton.js';

interface RunItem {
  id: string;
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'error' | string;
  startedAt: string;
  durationMs: number | null;
  evidenceIds?: string[];
}

interface RecentRunsTableProps {
  onOpenRun: () => void;
}

function statusPill(status: string): string {
  switch (status) {
    case 'passed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'error':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'running':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    default:
      return 'border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-muted)]';
  }
}

export function RecentRunsTable({ onOpenRun }: RecentRunsTableProps): JSX.Element {
  const [items, setItems] = useState<RunItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/test-runs?limit=8', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { items: RunItem[] };
        if (!cancelled) setItems(body.items ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxDuration = Math.max(1, ...(items ?? []).map((r) => r.durationMs ?? 0));

  return (
    <section className="abh-card h-full p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--secondary-soft)] text-[var(--secondary)]">
            <IconPaperclip size={16} />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Recent Test Runs</h2>
            <p className="text-xs text-[var(--text-muted)]">Latest 8 executions across all applications.</p>
          </div>
        </div>
        <button type="button" onClick={onOpenRun} className="abh-btn abh-btn-ghost abh-btn-sm">
          All runs
        </button>
      </div>
      {error && <div className="text-sm text-red-600">Failed to load: {error}</div>}
      {!error && items === null && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      )}
      {!error && items && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          No test runs yet. Open Tests and press &quot;Run Test&quot; on any test.
        </div>
      )}
      {!error && items && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                <th scope="col" className="pb-2 pr-3 font-medium">Test</th>
                <th scope="col" className="pb-2 pr-3 font-medium">Status</th>
                <th scope="col" className="pb-2 pr-3 font-medium">Duration</th>
                <th scope="col" className="pb-2 pr-3 font-medium">Started</th>
                <th scope="col" className="pb-2 font-medium sr-only">Evidence</th>
              </tr>
            </thead>
            <tbody className="abh-stagger">
              {items.map((r) => (
                <tr
                  key={r.id}
                  onClick={onOpenRun}
                  className="group cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <td className="py-2.5 pr-3 font-medium text-[var(--text)]">
                    <div className="max-w-xs truncate transition-transform group-hover:translate-x-0.5">{r.testName || r.testId}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                      <div className="hidden h-1 w-16 overflow-hidden rounded-full bg-[var(--surface-hover)] sm:block">
                        <div
                          className="abh-grow-x h-full rounded-full"
                          style={{
                            width: `${((r.durationMs ?? 0) / maxDuration) * 100}%`,
                            background: 'linear-gradient(90deg, var(--secondary), var(--primary))',
                          }}
                        />
                      </div>
                      {formatDuration(r.durationMs ?? 0)}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--text-muted)]">
                    {formatRelativeTime(r.startedAt)}
                  </td>
                  <td className="py-2.5 text-[var(--text-subtle)]">
                    {r.evidenceIds && r.evidenceIds.length > 0 && (
                      <IconPaperclip size={14} aria-label={`${r.evidenceIds.length} evidence`} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
