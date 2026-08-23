import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserRole } from '@ai-bug-hunter/shared';
import {
  IconPlus,
  IconGlobe,
  IconRefresh,
  IconChevronRight,
} from '../icons.js';
import { SkeletonCard } from '../dashboard/Skeleton.js';
import { DashboardError } from '../dashboard/DashboardError.js';
import { AddApplicationModal } from './AddApplicationModal.js';
import { DiscoveryPanel } from './DiscoveryPanel.js';
import { ApplicationDetailView } from './ApplicationDetailView.js';
import { ThemedPageHeader } from '../shared/ThemedPageHeader.js';
import type { ApplicationRow, ApplicationListResponse } from './types.js';

interface ApplicationsViewProps {
  role: UserRole;
  onNavigateToTests: (applicationId: string | null) => void;
}

interface ListState {
  items: ApplicationRow[] | null;
  loading: boolean;
  error: string | null;
  requestId?: string | null;
}

interface AppMetrics {
  testCount: number | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
}

interface OverviewLite {
  applications?: { count: number };
  testRuns?: { totalRecent: number; passed: number; failed: number };
  qualityScore?: { score: number; sampleSize: number } | null;
}

export function ApplicationsView({ role, onNavigateToTests }: ApplicationsViewProps): JSX.Element {
  const canWrite = role === 'admin' || role === 'qa_engineer';
  const [state, setState] = useState<ListState>({ items: null, loading: true, error: null });
  const [refreshTick, setRefreshTick] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discoverForId, setDiscoverForId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, AppMetrics>>({});
  const [overview, setOverview] = useState<OverviewLite | null>(null);

  const fetchList = useCallback(async (): Promise<void> => {
    setState((s) => ({ ...s, loading: s.items === null, error: null }));
    try {
      const res = await fetch('/api/applications?limit=100', { credentials: 'include' });
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
        setState({ items: null, loading: false, error: msg, requestId });
        return;
      }
      const body = (await res.json()) as ApplicationListResponse;
      setState({ items: body.items ?? [], loading: false, error: null, requestId });
    } catch (e) {
      setState({
        items: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load applications',
      });
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/overview', { credentials: 'include' });
        if (!res.ok) return;
        const body = (await res.json()) as OverviewLite;
        if (!cancelled) setOverview(body);
      } catch {
        // ignore
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;
    const items = state.items ?? [];
    if (items.length === 0) return;
    (async () => {
      const next: Record<string, AppMetrics> = {};
      await Promise.all(
        items.map(async (app) => {
          try {
            const res = await fetch(
              `/api/test-cases?applicationId=${encodeURIComponent(app.id)}&limit=1`,
              { credentials: 'include' },
            );
            if (!res.ok) {
              next[app.id] = { testCount: null, lastRunAt: null, lastRunStatus: null };
              return;
            }
            const body = (await res.json()) as { total?: number };
            next[app.id] = {
              testCount: typeof body.total === 'number' ? body.total : null,
              lastRunAt: null,
              lastRunStatus: null,
            };
          } catch {
            next[app.id] = { testCount: null, lastRunAt: null, lastRunStatus: null };
          }
        }),
      );
      if (!cancelled) setMetrics(next);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [state.items]);

  const items = state.items ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (a) => a.name.toLowerCase().includes(q) || a.base_url.toLowerCase().includes(q),
    );
  }, [items, search]);

  const selected = selectedId ? items.find((a) => a.id === selectedId) ?? null : null;
  const discoverTarget = discoverForId ? items.find((a) => a.id === discoverForId) ?? null : null;

  if (selected) {
    return (
      <ApplicationDetailView
        application={selected}
        role={role}
        onBack={() => setSelectedId(null)}
        onGenerateTests={() => onNavigateToTests(selected.id)}
        onDeleted={() => {
          setSelectedId(null);
          setRefreshTick((t) => t + 1);
        }}
      />
    );
  }

  const totalTests = Object.values(metrics).reduce(
    (acc, m) => acc + (m?.testCount ?? 0),
    0,
  );
  const runs = overview?.testRuns;
  const failuresRecent = runs && typeof runs.failed === 'number' ? runs.failed : null;
  const avgQuality =
    overview?.qualityScore && overview.qualityScore.sampleSize > 0
      ? overview.qualityScore.score
      : null;

  return (
    <div className="space-y-6">
      <ThemedPageHeader
        eyebrow="APPLICATION INTELLIGENCE"
        title="Applications"
        subtitle="Register applications, run discovery, and orchestrate autonomous QA."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshTick((t) => t + 1)}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <IconRefresh size={14} />
              Refresh
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <IconPlus size={14} />
                Add application
              </button>
            )}
          </div>
        }
      />

      <MetricStrip
        appsCount={overview?.applications?.count ?? items.length}
        activeCount={items.length}
        testsCount={totalTests}
        failures={failuresRecent}
        quality={avgQuality}
      />

      {items.length > 5 && (
        <div>
          <label htmlFor="app-search" className="sr-only">Search applications</label>
          <input
            id="app-search"
            type="search"
            placeholder="Search by name or URL"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          />
        </div>
      )}

      {state.error && !state.loading && (
        <DashboardError
          message={state.error}
          requestId={state.requestId ?? null}
          onRetry={() => setRefreshTick((t) => t + 1)}
        />
      )}

      {state.loading && !state.items && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!state.loading && !state.error && items.length === 0 && (
        <EmptyState canWrite={canWrite} onAdd={() => setAddOpen(true)} />
      )}

      {!state.loading && !state.error && items.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          No applications match &quot;{search}&quot;.
        </div>
      )}

      {!state.loading && filtered.length > 0 && (
        <ul className="space-y-3">
          {filtered.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              metrics={metrics[app.id]}
              canWrite={canWrite}
              onView={() => setSelectedId(app.id)}
              onDiscover={() => setDiscoverForId(app.id)}
            />
          ))}
        </ul>
      )}

      <AddApplicationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => setRefreshTick((t) => t + 1)}
      />

      {discoverTarget && (
        <DiscoveryPanel
          open={Boolean(discoverTarget)}
          applicationBaseUrl={discoverTarget.base_url}
          onClose={() => setDiscoverForId(null)}
          onComplete={() => undefined}
          onGenerateTests={() => onNavigateToTests(discoverTarget.id)}
        />
      )}
    </div>
  );
}

function MetricStrip({
  appsCount,
  activeCount,
  testsCount,
  failures,
  quality,
}: {
  appsCount: number;
  activeCount: number;
  testsCount: number;
  failures: number | null;
  quality: number | null;
}): JSX.Element {
  const items: Array<{ label: string; value: string }> = [
    { label: 'Applications', value: String(appsCount) },
    { label: 'Active', value: String(activeCount) },
    { label: 'Tests', value: String(testsCount) },
    { label: 'Recent Failures', value: failures === null ? '—' : String(failures) },
    { label: 'Avg Quality', value: quality === null ? '—' : String(quality) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((m) => (
        <div
          key={m.label}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-subtle)]">
            {m.label}
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ canWrite, onAdd }: { canWrite: boolean; onAdd: () => void }): JSX.Element {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
        <IconGlobe size={22} />
      </div>
      <h3 className="mt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-subtle)]">
        No applications yet
      </h3>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Connect your first application to begin autonomous QA.
      </p>
      {canWrite ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 inline-flex items-center gap-1.5 rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <IconPlus size={14} />
          Add application
        </button>
      ) : (
        <p className="mt-4 text-xs text-[var(--text-subtle)]">
          You have read-only access. Ask an admin or QA engineer to register applications.
        </p>
      )}
    </div>
  );
}

interface RowProps {
  app: ApplicationRow;
  metrics: AppMetrics | undefined;
  canWrite: boolean;
  onView: () => void;
  onDiscover: () => void;
}

function ApplicationCard({ app, metrics, canWrite, onView, onDiscover }: RowProps): JSX.Element {
  const testCount = metrics?.testCount ?? null;
  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] transition-colors hover:border-[var(--border-strong)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full bg-[var(--success)]"
              aria-hidden
            />
            <button
              type="button"
              onClick={onView}
              className="truncate text-base font-semibold text-[var(--text)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              {app.name}
            </button>
            <span className="inline-flex items-center rounded-full border border-[var(--border-strong)] bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--primary)]">
              Ready
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <IconGlobe size={12} />
            <span className="truncate font-mono">{app.base_url}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canWrite && (
            <button
              type="button"
              onClick={onDiscover}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <IconRefresh size={12} />
              Discover
            </button>
          )}
          <button
            type="button"
            onClick={onView}
            className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            View
            <IconChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
          <MetricInline label="Quality" value="—" />
          <MetricInline label="Tests" value={testCount === null ? '—' : String(testCount)} />
          <MetricInline label="Pass rate" value="—" />
          <MetricInline label="Open bugs" value="—" />
          <MetricInline label="Last tested" value="—" />
        </dl>
        <TreeNode name={app.name} />
      </div>
    </li>
  );
}

function MetricInline({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-subtle)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums text-[var(--text)]">{value}</dd>
    </div>
  );
}

function TreeNode({ name }: { name: string }): JSX.Element {
  const label = name.length > 10 ? `${name.slice(0, 9)}…` : name;
  return (
    <svg
      width={220}
      height={90}
      viewBox="0 0 220 90"
      role="img"
      aria-label={`${name} relationships: Tests, Runs, Bugs, Reliability`}
      className="text-[var(--primary)]"
    >
      <circle cx="30" cy="45" r="10" fill="currentColor" opacity="0.85" />
      <text x="30" y="48" textAnchor="middle" fontSize="8" fill="white">
        {label.slice(0, 3)}
      </text>
      {[
        { y: 10, l: 'Tests' },
        { y: 32, l: 'Runs' },
        { y: 55, l: 'Bugs' },
        { y: 78, l: 'Reliab' },
      ].map((n) => (
        <g key={n.l}>
          <line
            x1={40}
            y1={45}
            x2={130}
            y2={n.y}
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth={1}
          />
          <circle cx={135} cy={n.y} r={4} fill="currentColor" opacity="0.6" />
          <text
            x={145}
            y={n.y + 3}
            fontSize="10"
            fill="currentColor"
            opacity="0.85"
          >
            {n.l}
          </text>
        </g>
      ))}
    </svg>
  );
}
