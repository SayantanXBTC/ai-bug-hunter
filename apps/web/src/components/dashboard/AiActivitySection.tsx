import type { DashboardOverviewResponse } from '@ai-bug-hunter/shared';
import { IconSparkles } from '../icons.js';
import { formatNumber } from '../../lib/format.js';

interface AiActivitySectionProps {
  aiMetrics: DashboardOverviewResponse['aiMetrics'];
}

interface OperationStats {
  count: number;
  latencyMs: number;
  tokens: number;
}

export function AiActivitySection({ aiMetrics }: AiActivitySectionProps): JSX.Element {
  // byOperation is provided by the API snapshot but not typed on the shared response —
  // read it defensively via cast.
  const extended = aiMetrics as unknown as {
    byOperation?: Record<string, OperationStats>;
  };
  const byOperation = extended.byOperation ?? {};
  const topOperations = Object.entries(byOperation)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);
  const empty = aiMetrics.requestCount === 0;

  return (
    <section className="rounded-lg border border-violet-100 bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <div className="mb-3 flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
        <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">AI Activity</h2>
      </div>
      <p className="mb-3 text-xs text-[var(--text-muted)] flex items-center gap-1">
        <IconSparkles size={12} className="text-violet-500" /> AI-assisted operations
      </p>

      {empty ? (
        <div className="rounded border border-dashed border-[var(--border)] bg-[var(--surface-hover)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          No recent AI activity
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {aiMetrics.provider && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                {aiMetrics.provider}
              </span>
            )}
            {aiMetrics.model && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-2 py-0.5 font-medium text-[var(--text-muted)]">
                {aiMetrics.model}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Requests</dt>
              <dd className="text-lg font-semibold tabular-nums text-[var(--text)]">
                {formatNumber(aiMetrics.requestCount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Success</dt>
              <dd className="text-lg font-semibold tabular-nums text-emerald-700">
                {formatNumber(aiMetrics.successCount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Failure</dt>
              <dd className="text-lg font-semibold tabular-nums text-red-700">
                {formatNumber(aiMetrics.failureCount)}
              </dd>
            </div>
          </dl>
          {topOperations.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Top operations
              </div>
              <ul className="divide-y divide-[var(--border)] text-sm">
                {topOperations.map(([name, stats]) => (
                  <li key={name} className="flex items-center justify-between py-1.5">
                    <span className="text-[var(--text)]">{name}</span>
                    <span className="tabular-nums text-[var(--text-muted)]">
                      {formatNumber(stats.count)} · {stats.count > 0 ? Math.round(stats.latencyMs / stats.count) : 0}ms avg
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
