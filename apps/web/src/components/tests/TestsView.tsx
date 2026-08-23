import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserRole } from '@ai-bug-hunter/shared';
import {
  IconSparkles,
  IconRefresh,
  IconChevronRight,
  IconEye,
  IconGlobe,
  IconAlertTriangle,
} from '../icons.js';
import { OrbitalEmptyState } from '../shared/OrbitalEmptyState.js';
import { ThemedPageHeader } from '../shared/ThemedPageHeader.js';
import { SkeletonCard } from '../dashboard/Skeleton.js';
import { DashboardError } from '../dashboard/DashboardError.js';
import { formatRelativeTime, formatPercent } from '../../lib/format.js';
import { GenerateTestsModal } from './GenerateTestsModal.js';
import { RunTestButton } from './RunTestButton.js';
import { TestDetailView } from './TestDetailView.js';
import type {
  ApplicationOption,
  ReliabilityRecord,
  TestCaseListResponse,
  TestCaseRow,
  TestRunSummary,
} from './types.js';
import { sourceOfTestCase } from './types.js';

interface TestsViewProps {
  role: UserRole;
  onNavigateToRun?: (runId: string) => void;
  onNavigateToApplications?: (applicationId: string) => void;
}

interface ListState {
  loading: boolean;
  error: string | null;
  requestId?: string | null;
  items: TestCaseRow[] | null;
}

type SourceFilter = 'all' | 'ai' | 'manual';
type StatusFilter = 'all' | 'enabled' | 'disabled';

export function TestsView({
  role,
  onNavigateToRun,
  onNavigateToApplications,
}: TestsViewProps): JSX.Element {
  const canWrite = role === 'admin' || role === 'qa_engineer';
  const [state, setState] = useState<ListState>({ loading: true, error: null, items: null });
  const [apps, setApps] = useState<ApplicationOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Enrichment: run history and reliability keyed by external_test_id
  const [runByExternalId, setRunByExternalId] = useState<Record<string, TestRunSummary>>({});
  const [reliabilityByExternalId, setReliabilityByExternalId] = useState<
    Record<string, ReliabilityRecord>
  >({});

  const fetchList = useCallback(async () => {
    setState((s) => ({ ...s, loading: s.items === null, error: null }));
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (appFilter !== 'all') params.set('applicationId', appFilter);
      if (statusFilter === 'enabled') params.set('enabled', 'true');
      if (statusFilter === 'disabled') params.set('enabled', 'false');
      const res = await fetch(`/api/test-cases?${params.toString()}`, {
        credentials: 'include',
      });
      const requestId = res.headers.get('x-request-id');
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string; message?: string };
          if (body?.error) msg = body.error;
          else if (body?.message) msg = body.message;
        } catch {
          // ignore
        }
        setState({ loading: false, error: msg, items: null, requestId });
        return;
      }
      const body = (await res.json()) as TestCaseListResponse;
      setState({ loading: false, error: null, items: body.items ?? [], requestId });
    } catch (e) {
      setState({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load tests',
        items: null,
      });
    }
  }, [appFilter, statusFilter]);

  useEffect(() => {
    void fetchList();
  }, [fetchList, tick]);

  // Load applications for filter and generate modal.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/applications?limit=100', { credentials: 'include' });
        if (!res.ok) return;
        const body = (await res.json()) as { items: ApplicationOption[] };
        if (!cancelled) setApps(body.items ?? []);
      } catch {
        // ignore
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Batch enrichment: single fetch of recent runs, matched client-side to tests
  // by external_test_id. Cheaper than one call per test.
  useEffect(() => {
    const items = state.items ?? [];
    if (items.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/test-runs?limit=200', { credentials: 'include' });
        if (!res.ok) return;
        const body = (await res.json()) as { items: TestRunSummary[] };
        const map: Record<string, TestRunSummary> = {};
        for (const r of body.items ?? []) {
          if (!r.testId) continue;
          const existing = map[r.testId];
          if (!existing) {
            map[r.testId] = r;
            continue;
          }
          const existingWhen = existing.startedAt ?? existing.createdAt ?? '';
          const currentWhen = r.startedAt ?? r.createdAt ?? '';
          if (currentWhen > existingWhen) map[r.testId] = r;
        }
        if (!cancelled) setRunByExternalId(map);
      } catch {
        // ignore
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [state.items]);

  // Reliability enrichment via list endpoint (avoids N calls).
  useEffect(() => {
    const items = state.items ?? [];
    if (items.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/test-reliability?limit=100', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const body = (await res.json()) as { items: ReliabilityRecord[] };
        const map: Record<string, ReliabilityRecord> = {};
        for (const r of body.items ?? []) {
          if (r.externalTestId) map[r.externalTestId] = r;
        }
        if (!cancelled) setReliabilityByExternalId(map);
      } catch {
        // ignore
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [state.items]);

  const items = state.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (sourceFilter !== 'all' && sourceOfTestCase(t) !== sourceFilter) return false;
      return true;
    });
  }, [items, search, sourceFilter]);

  if (selectedId) {
    return (
      <TestDetailView
        testCaseId={selectedId}
        role={role}
        applications={apps}
        onBack={() => setSelectedId(null)}
        onDeleted={() => {
          setSelectedId(null);
          setTick((t) => t + 1);
        }}
        {...(onNavigateToRun ? { onNavigateToRun } : {})}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ThemedPageHeader
        eyebrow="TEST INTELLIGENCE"
        title="Tests"
        subtitle="Create, inspect, validate, and execute executable QA tests."
        actions={
          <>
            <button
              type="button"
              onClick={() => setTick((t) => t + 1)}
              disabled={state.loading}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-60"
            >
              <IconRefresh size={14} className={state.loading ? 'animate-spin' : undefined} />
              Refresh
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={() => setGenerateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <IconSparkles size={14} />
                Generate Tests
              </button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="test-search">
          Search tests
        </label>
        <input
          id="test-search"
          type="search"
          placeholder="Search tests by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        />
        <select
          value={appFilter}
          onChange={(e) => setAppFilter(e.target.value)}
          aria-label="Filter by application"
          className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <option value="all">All applications</option>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <option value="all">All statuses</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
          aria-label="Filter by source"
          className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <option value="all">All sources</option>
          <option value="ai">AI Generated</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {state.error && !state.loading && (
        <DashboardError
          message={state.error}
          requestId={state.requestId ?? null}
          onRetry={() => setTick((t) => t + 1)}
        />
      )}

      {state.loading && !state.items && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!state.loading && !state.error && items.length === 0 && (
        <EmptyState canWrite={canWrite} onGenerate={() => setGenerateOpen(true)} />
      )}

      {!state.loading && items.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)] shadow-[var(--shadow)]">
          No tests match the current filters.
        </div>
      )}

      {!state.loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-hover)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-subtle)]">
              <tr>
                <th className="px-4 py-2">Test</th>
                <th className="px-4 py-2">Application</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Last Result</th>
                <th className="px-4 py-2">Reliability</th>
                <th className="px-4 py-2">Last Run</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((t) => {
                const externalId = t.external_test_id ?? t.definition.id;
                const lastRun = externalId ? runByExternalId[externalId] : undefined;
                const rel = externalId ? reliabilityByExternalId[externalId] : undefined;
                const app = apps.find((a) => a.id === t.application_id);
                return (
                  <tr key={t.id} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className="text-left font-medium text-[var(--text)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        {t.name}
                      </button>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-subtle)]">
                        <IconGlobe size={10} />
                        <span className="truncate font-mono">{t.target_url}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">
                      {app ? app.name : <span className="text-[var(--text-subtle)]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <SourcePill isAi={sourceOfTestCase(t) === 'ai'} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill enabled={t.enabled} />
                    </td>
                    <td className="px-4 py-3">
                      {lastRun ? (
                        <RunStatusPill status={lastRun.status} />
                      ) : (
                        <span className="text-[var(--text-subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rel ? <ReliabilityCell record={rel} /> : <span className="text-[var(--text-subtle)]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-subtle)]">
                      {lastRun ? formatRelativeTime(lastRun.startedAt ?? lastRun.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {canWrite && <RunTestButton testCase={t} {...(onNavigateToRun ? { onNavigateToRun } : {})} />}
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        >
                          <IconEye size={12} />
                          View
                          <IconChevronRight size={10} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <GenerateTestsModal
        open={generateOpen}
        applications={apps}
        onClose={() => setGenerateOpen(false)}
        onSaved={(n) => {
          setGenerateOpen(false);
          if (n > 0) setTick((t) => t + 1);
        }}
        {...(onNavigateToApplications ? { onNavigateToApplications } : {})}
      />
    </div>
  );
}

function EmptyState({
  canWrite,
  onGenerate,
}: {
  canWrite: boolean;
  onGenerate: () => void;
}): JSX.Element {
  if (canWrite) {
    return (
      <OrbitalEmptyState
        visualization="nodes"
        accent="violet"
        title="No tests yet"
        subtitle="Discover an application or generate your first AI-assisted test suite."
        cta={{ label: 'Generate Tests', onClick: onGenerate, icon: <IconSparkles size={14} /> }}
      />
    );
  }
  return (
    <OrbitalEmptyState
      visualization="nodes"
      accent="violet"
      title="No tests yet"
      subtitle="You have read-only access. Ask a QA engineer to generate tests."
    />
  );
}

function SourcePill({ isAi }: { isAi: boolean }): JSX.Element {
  if (isAi) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
        <IconSparkles size={10} />
        AI Generated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
      Manual
    </span>
  );
}

function StatusPill({ enabled }: { enabled: boolean }): JSX.Element {
  return enabled ? (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
      Enabled
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-[var(--text-subtle)]">
      Disabled
    </span>
  );
}

function RunStatusPill({ status }: { status: string }): JSX.Element {
  const map: Record<string, string> = {
    passed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    failed: 'border-red-200 bg-red-50 text-red-700',
    errored: 'border-amber-200 bg-amber-50 text-amber-700',
    running: 'border-blue-200 bg-blue-50 text-blue-700',
    pending: 'border-neutral-200 bg-neutral-50 text-neutral-600',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] ?? 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}
    >
      {status}
    </span>
  );
}

function ReliabilityCell({ record }: { record: ReliabilityRecord }): JSX.Element {
  const cls: Record<string, string> = {
    stable: 'text-emerald-700',
    suspected_flaky: 'text-amber-700',
    flaky: 'text-amber-800',
    unstable: 'text-red-700',
    insufficient_data: 'text-[var(--text-subtle)]',
  };
  if (record.status === 'insufficient_data') {
    return <span className="text-xs text-[var(--text-subtle)]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      {(record.status === 'flaky' || record.status === 'suspected_flaky') && (
        <IconAlertTriangle size={10} className="text-amber-600" />
      )}
      <span className={`tabular-nums font-medium ${cls[record.status] ?? 'text-[var(--text)]'}`}>
        {formatPercent(record.passRate)}
      </span>
      <span className="text-[var(--text-subtle)]">({record.totalRuns})</span>
    </span>
  );
}
