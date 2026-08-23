import { useMemo, useState } from 'react';
import { useTestRuns, type TestRunSummary } from '../hooks/useTestRuns.js';
import { PageHeader } from './shared/PageHeader.js';
import { MetricPanel } from './shared/MetricPanel.js';
import { StatusPill, type PillTone } from './shared/StatusPill.js';
import { IconRefresh, IconChevronRight, IconSpinner } from './icons.js';
import { formatDuration, formatRelativeTime } from '../lib/format.js';

interface Props {
  onSelect: (id: string) => void;
}

const STATUS_TONE: Record<TestRunSummary['status'], PillTone> = {
  passed: 'passed',
  failed: 'failed',
  error: 'error',
};

const PAGE_LIMIT = 20;

export function TestRunList({ onSelect }: Props): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TestRunSummary['status']>('all');
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

  const loading = !data && !error;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="EXECUTION TELEMETRY"
        title="Test Runs"
        subtitle="Execution telemetry and evidence from autonomous QA runs."
        actions={
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-violet-500/40 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            {loading ? <IconSpinner size={14} /> : <IconRefresh size={14} />}
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricPanel index={0} label="Total Runs" value={loading ? '—' : metrics.total} accent="violet" />
        <MetricPanel index={1} label="Passed" value={loading ? '—' : metrics.passed} accent="emerald" />
        <MetricPanel index={2} label="Failed" value={loading ? '—' : metrics.failed} accent="red" />
        <MetricPanel index={3} label="Errors" value={loading ? '—' : metrics.errored} accent="orange" />
        <MetricPanel
          index={4}
          label="Avg Duration"
          value={metrics.avg === null ? '—' : formatDuration(metrics.avg)}
          accent="cyan"
        />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[rgba(12,14,22,0.65)] p-4 backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test name or run id…"
            className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white/90 placeholder:text-neutral-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white/90 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          >
            <option value="all">All statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          {error ? (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
              Failed to load test runs: {error}
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-white/[0.03]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
              <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
                No Data
              </div>
              <div className="mt-2 text-sm text-neutral-400">
                No test runs yet. Trigger a run from the Tests page.
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                  <th scope="col" className="px-3 py-2">Test</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Duration</th>
                  <th scope="col" className="px-3 py-2">Started</th>
                  <th scope="col" className="px-3 py-2">Run ID</th>
                  <th scope="col" className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onSelect(r.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(r.id);
                      }
                    }}
                    className="tr-row group cursor-pointer border-t border-white/[0.04] transition-colors hover:bg-white/[0.03] focus:bg-white/[0.03] focus:outline-none"
                  >
                    <td className="px-3 py-3 text-white/90">
                      <div className="truncate max-w-[280px]">{r.testName}</div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill tone={STATUS_TONE[r.status]}>{r.status}</StatusPill>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-neutral-300">
                      {formatDuration(r.durationMs)}
                    </td>
                    <td className="px-3 py-3 text-neutral-400">
                      {formatRelativeTime(r.startedAt)}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-neutral-500">
                      {r.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-3 text-right text-neutral-500 group-hover:text-violet-300">
                      <IconChevronRight size={14} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && data.total > data.limit && (
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-3 text-xs text-neutral-500">
            <span className="tabular-nums">
              {data.total.toLocaleString()} total · Page {data.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-white/10 px-2 py-1 text-neutral-300 hover:bg-white/[0.05] disabled:opacity-30"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-white/10 px-2 py-1 text-neutral-300 hover:bg-white/[0.05] disabled:opacity-30"
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
