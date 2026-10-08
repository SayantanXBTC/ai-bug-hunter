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

  const successPct = aiMetrics.requestCount > 0 ? aiMetrics.successCount / aiMetrics.requestCount : 0;

  return (
    <section className="abh-card abh-glow-border relative h-full overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: 'var(--primary)', opacity: 0.12 }}
      />
      <div className="relative mb-1 flex items-center gap-3">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-strong)]">
          <IconSparkles size={16} className={empty ? '' : 'abh-spin-slow'} />
        </span>
        <div>
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">AI Activity</h2>
          </div>
          <p className="text-xs text-[var(--text-muted)]">AI-assisted operations since the API started</p>
        </div>
      </div>

      {empty ? (
        <div className="relative mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No recent AI activity</p>
          <p className="mt-1 text-xs text-[var(--text-subtle)]">Generating tests or investigating a failure will show up here.</p>
        </div>
      ) : (
        <div className="relative mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {aiMetrics.provider && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                {aiMetrics.provider}
              </span>
            )}
            {aiMetrics.model && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                {aiMetrics.model}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-[var(--surface-hover)] p-3">
              <dt className="text-[11px] text-[var(--text-muted)]">Requests</dt>
              <dd className="text-lg font-semibold tabular-nums text-[var(--text)]">
                {formatNumber(aiMetrics.requestCount)}
              </dd>
            </div>
            <div className="rounded-xl bg-[var(--surface-hover)] p-3">
              <dt className="text-[11px] text-[var(--text-muted)]">Success</dt>
              <dd className="text-lg font-semibold tabular-nums text-emerald-700">
                {formatNumber(aiMetrics.successCount)}
              </dd>
            </div>
            <div className="rounded-xl bg-[var(--surface-hover)] p-3">
              <dt className="text-[11px] text-[var(--text-muted)]">Failure</dt>
              <dd className="text-lg font-semibold tabular-nums text-red-700">
                {formatNumber(aiMetrics.failureCount)}
              </dd>
            </div>
          </dl>
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-[var(--text-subtle)]">
              <span>Success rate</span>
              <span className="tabular-nums">{Math.round(successPct * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div className="abh-grow-x h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${successPct * 100}%` }} />
            </div>
          </div>
          {topOperations.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-subtle)]">
                Top operations
              </div>
              <ul className="divide-y divide-[var(--border)] text-sm">
                {topOperations.map(([name, stats]) => (
                  <li key={name} className="flex items-center justify-between py-1.5">
                    <span className="text-[var(--text)]">{name}</span>
                    <span className="tabular-nums text-xs text-[var(--text-muted)]">
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
