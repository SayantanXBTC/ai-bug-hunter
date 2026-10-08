import { useMemo, useState } from 'react';
import { useTestRuns, type TestRunSummary } from '../hooks/useTestRuns.js';
import { PageHeader } from './shared/PageHeader.js';
import { MetricPanel } from './shared/MetricPanel.js';
import { StatusPill, type PillTone } from './shared/StatusPill.js';
import { IconRefresh, IconChevronRight, IconSpinner, IconList, IconSearch, IconCheck, IconX, IconAlertTriangle, IconSparkles } from './icons.js';
import { OrbitalEmptyState } from './shared/OrbitalEmptyState.js';
import { formatDuration, formatRelativeTime } from '../lib/format.js';
import { entryFor } from './navigation.js';

interface Props {
  onSelect: (id: string) => void;
  /** Shown in the empty state so new users know where runs come from. */
  onNavigateToTests?: () => void;
}

const STATUS_TONE: Record<TestRunSummary['status'], PillTone> = {
  passed: 'passed',
  failed: 'failed',
  error: 'error',
};

const STATUS_COLOR: Record<TestRunSummary['status'], string> = {
  passed: 'var(--success)',
  failed: 'var(--danger)',
  error: 'var(--warning)',
};

const PAGE_LIMIT = 20;

type StatusFilter = 'all' | TestRunSummary['status'];

function StatusGlyph({ status }: { status: TestRunSummary['status'] }): JSX.Element {
  const Icon = status === 'passed' ? IconCheck : status === 'failed' ? IconX : IconAlertTriangle;
  return (
    <span
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
      style={{ background: `color-mix(in srgb, ${STATUS_COLOR[status]} 14%, transparent)`, color: STATUS_COLOR[status] }}
    >
      {status !== 'passed' && (
        <span className="absolute inset-0 animate-ping rounded-xl opacity-10" style={{ background: STATUS_COLOR[status] }} />
      )}
      <Icon size={14} />
    </span>
  );
}

export function TestRunList({ onSelect, onNavigateToTests }: Props): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data, error, refresh } = useTestRuns(page, PAGE_LIMIT);

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q && !r.testName.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, statusFilter]);

  const metrics = useMemo(() => {
    const total = items.length;
    const passed = items.filter((r) => r.status === 'passed').length;
    const failed = items.filter((r) => r.status === 'failed').length;
    const errored = items.filter((r) => r.status === 'error').length;
    const avg = total > 0 ? items.reduce((s, r) => s + (r.durationMs ?? 0), 0) / total : null;
    return { total, passed, failed, errored, avg };
  }, [items]);

  const maxDuration = useMemo(() => Math.max(1, ...items.map((r) => r.durationMs ?? 0)), [items]);

  const loading = !data && !error;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const toggle = (s: StatusFilter): void => setStatusFilter((cur) => (cur === s ? 'all' : s));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="STEP 3 · EXECUTION TELEMETRY"
        title="Test Runs"
        subtitle="Execution telemetry and evidence from autonomous QA runs."
        icon={<IconList size={22} />}
        guide={entryFor('test-runs').guide}
        actions={
          <button type="button" onClick={refresh} className="abh-btn abh-btn-ghost">
            {loading ? <IconSpinner size={14} /> : <IconRefresh size={14} />}
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricPanel index={0} label="Total Runs" value={loading ? '—' : metrics.total} accent="violet" onClick={() => setStatusFilter('all')} active={statusFilter === 'all' && !loading} />
        <MetricPanel index={1} label="Passed" value={loading ? '—' : metrics.passed} accent="emerald" onClick={() => toggle('passed')} active={statusFilter === 'passed'} />
        <MetricPanel index={2} label="Failed" value={loading ? '—' : metrics.failed} accent="red" onClick={() => toggle('failed')} active={statusFilter === 'failed'} />
        <MetricPanel index={3} label="Errors" value={loading ? '—' : metrics.errored} accent="orange" onClick={() => toggle('error')} active={statusFilter === 'error'} />
        <MetricPanel
          index={4}
          label="Avg Duration"
          value={metrics.avg === null ? '—' : formatDuration(metrics.avg)}
          accent="cyan"
        />
      </div>

      {!loading && metrics.total > 0 && (
        <div className="abh-card p-4">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-subtle)]">
            <span>Outcome mix · this page</span>
            <span className="tabular-nums">{Math.round((metrics.passed / metrics.total) * 100)}% pass</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            {(['passed', 'failed', 'error'] as const).map((s) => {
              const n = s === 'passed' ? metrics.passed : s === 'failed' ? metrics.failed : metrics.errored;
              if (n === 0) return null;
              return (
                <button
                  key={s}
                  type="button"
                  aria-label={`Show ${s} runs`}
                  onClick={() => toggle(s)}
                  className="abh-grow-x h-full transition-opacity hover:opacity-80"
                  style={{ width: `${(n / metrics.total) * 100}%`, background: STATUS_COLOR[s] }}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="abh-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search test name or run id…"
              className="abh-input pl-9"
            />
          </div>
          <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-1.5">
            {(['all', 'passed', 'failed', 'error'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                className="abh-chip"
              >
                {s !== 'all' && <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />}
                {s === 'all' ? 'All statuses' : s === 'passed' ? 'Passed' : s === 'failed' ? 'Failed' : 'Error'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
              Failed to load test runs: {error}
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="abh-skeleton h-14 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            items.length === 0 ? (
              <OrbitalEmptyState
                visualization="planet"
                accent="cyan"
                title="No test runs yet"
                subtitle="Run a test to begin collecting execution evidence."
                {...(onNavigateToTests
                  ? { cta: { label: 'Go to Tests', onClick: onNavigateToTests, icon: <IconSparkles size={14} /> } }
                  : {})}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
                No runs match this filter.{' '}
                <button type="button" className="text-[var(--primary-strong)] hover:underline" onClick={() => { setStatusFilter('all'); setSearch(''); }}>
                  Clear filters
                </button>
              </div>
            )
          ) : (
            <ul className="abh-stagger space-y-1.5">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:grid-cols-[auto_1fr_150px_110px_90px_auto]"
                  >
                    <StatusGlyph status={r.status} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--text)]">{r.testName}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-subtle)]">
                        <StatusPill tone={STATUS_TONE[r.status]}>{r.status}</StatusPill>
                        <span className="sm:hidden">{formatRelativeTime(r.startedAt)}</span>
                      </div>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                        <div
                          className="abh-grow-x h-full rounded-full"
                          style={{
                            width: `${((r.durationMs ?? 0) / maxDuration) * 100}%`,
                            background: `linear-gradient(90deg, ${STATUS_COLOR[r.status]}, var(--secondary))`,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-[var(--text-muted)]">
                        {formatDuration(r.durationMs)}
                      </span>
                    </div>
                    <span className="hidden text-xs text-[var(--text-muted)] sm:block">{formatRelativeTime(r.startedAt)}</span>
                    <span className="hidden font-mono text-[11px] text-[var(--text-subtle)] sm:block">{r.id.slice(0, 8)}</span>
                    <IconChevronRight
                      size={14}
                      className="text-[var(--text-subtle)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--primary-strong)]"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data && data.total > data.limit && (
          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--text-subtle)]">
            <span className="tabular-nums">
              {data.total.toLocaleString()} total · Page {data.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="abh-btn abh-btn-ghost abh-btn-sm"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="abh-btn abh-btn-ghost abh-btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
