import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserRole } from '@ai-bug-hunter/shared';
import {
  IconPlus,
  IconGlobe,
  IconRefresh,
  IconChevronRight,
  IconLayers,
  IconSparkles,
  IconCompass,
  IconCheck,
  IconExternalLink,
  IconSearch,
} from '../icons.js';
import { MetricPanel } from '../shared/MetricPanel.js';
import { entryFor } from '../navigation.js';
import { useSpotlight } from '../../lib/motion.js';
import { formatRelativeTime } from '../../lib/format.js';
import { SkeletonCard } from '../dashboard/Skeleton.js';
import { DashboardError } from '../dashboard/DashboardError.js';
import { AddApplicationModal } from './AddApplicationModal.js';
import { DiscoveryPanel } from './DiscoveryPanel.js';
import { ApplicationDetailView } from './ApplicationDetailView.js';
import { ThemedPageHeader } from '../shared/ThemedPageHeader.js';
import { OrbitalEmptyState } from '../shared/OrbitalEmptyState.js';
import type { ApplicationRow, ApplicationListResponse } from './types.js';

interface ApplicationsViewProps {
  role: UserRole;
  onNavigateToTests: (applicationId: string | null) => void;
  /** Open the "Add application" modal on arrival (quick action / command palette). */
  openAddOnMount?: boolean;
  onActionConsumed?: () => void;
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

export function ApplicationsView({
  role,
  onNavigateToTests,
  openAddOnMount = false,
  onActionConsumed,
}: ApplicationsViewProps): JSX.Element {
  const canWrite = role === 'admin' || role === 'qa_engineer';
  const [state, setState] = useState<ListState>({ items: null, loading: true, error: null });
  const [refreshTick, setRefreshTick] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discoverForId, setDiscoverForId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, AppMetrics>>({});
  const [overview, setOverview] = useState<OverviewLite | null>(null);

  useEffect(() => {
    if (!openAddOnMount) return;
    if (canWrite) setAddOpen(true);
    onActionConsumed?.();
  }, [openAddOnMount, canWrite, onActionConsumed]);

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

  const guide = entryFor('applications').guide;

  return (
    <div className="space-y-6">
      <ThemedPageHeader
        eyebrow="STEP 1 · APPLICATION INTELLIGENCE"
        title="Applications"
        subtitle="Register applications, run discovery, and orchestrate autonomous QA."
        icon={<IconLayers size={22} />}
        guide={guide}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshTick((t) => t + 1)}
              disabled={state.loading}
              className="abh-btn abh-btn-ghost"
            >
              <IconRefresh size={14} className={state.loading ? 'animate-spin' : undefined} />
              Refresh
            </button>
            {canWrite && (
              <button type="button" onClick={() => setAddOpen(true)} className="abh-btn abh-btn-primary">
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

      {items.length > 3 && (
        <div className="relative max-w-sm">
          <label htmlFor="app-search" className="sr-only">Search applications</label>
          <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input
            id="app-search"
            type="search"
            placeholder="Search by name or URL"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="abh-input pl-9"
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
        <div className="abh-card p-6 text-sm text-[var(--text-muted)]">
          No applications match &quot;{search}&quot;.
        </div>
      )}

      {!state.loading && filtered.length > 0 && (
        <ul className="abh-stagger grid gap-4 xl:grid-cols-2">
          {filtered.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              metrics={metrics[app.id]}
              canWrite={canWrite}
              onView={() => setSelectedId(app.id)}
              onDiscover={() => setDiscoverForId(app.id)}
              onTests={() => onNavigateToTests(app.id)}
            />
          ))}
          {canWrite && (
            <li>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="group flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-strong)] p-6 text-[var(--text-muted)] transition-all hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--text)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-strong)] transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110">
                  <IconPlus size={20} />
                </span>
                <span className="text-sm font-medium">Add another application</span>
              </button>
            </li>
          )}
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
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricPanel index={0} label="Applications" value={appsCount} accent="violet" />
      <MetricPanel index={1} label="Active" value={activeCount} accent="cyan" />
      <MetricPanel index={2} label="Tests" value={testsCount} accent="emerald" />
      <MetricPanel index={3} label="Recent Failures" value={failures === null ? '—' : failures} accent="red" />
      <MetricPanel index={4} label="Avg Quality" value={quality === null ? '—' : quality} accent="orange" />
    </div>
  );
}

function EmptyState({ canWrite, onAdd }: { canWrite: boolean; onAdd: () => void }): JSX.Element {
  if (canWrite) {
    return (
      <OrbitalEmptyState
        visualization="planet"
        accent="violet"
        title="No applications yet"
        subtitle="Connect your first application to begin autonomous testing."
        steps={[
          'Add the public URL of the app you want tested.',
          'Press Discover to crawl its pages and forms.',
          'Generate AI tests from what was found.',
        ]}
        cta={{ label: 'Add Application', onClick: onAdd, icon: <IconPlus size={14} /> }}
      />
    );
  }
  return (
    <OrbitalEmptyState
      visualization="planet"
      accent="violet"
      title="No applications yet"
      subtitle="You have read-only access. Ask an admin or QA engineer to register applications."
    />
  );
}

interface RowProps {
  app: ApplicationRow;
  metrics: AppMetrics | undefined;
  canWrite: boolean;
  onView: () => void;
  onDiscover: () => void;
  onTests: () => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const AVATAR_GRADIENTS = [
  ['#8b5cf6', '#22d3ee'],
  ['#a855f7', '#ec4899'],
  ['#6366f1', '#10b981'],
  ['#f59e0b', '#ef4444'],
  ['#06b6d4', '#8b5cf6'],
];

function gradientFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const g = AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]!;
  return [g[0]!, g[1]!];
}

function ApplicationCard({ app, metrics, canWrite, onView, onDiscover, onTests }: RowProps): JSX.Element {
  const spot = useSpotlight();
  const testCount = metrics?.testCount ?? null;
  const hasTests = (testCount ?? 0) > 0;
  const [c1, c2] = gradientFor(app.id);
  const initials = app.name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const stages: Array<{ label: string; done: boolean }> = [
    { label: 'Registered', done: true },
    { label: 'Tests generated', done: hasTests },
    { label: 'Ready to run', done: hasTests },
  ];

  return (
    <li
      onMouseMove={spot}
      className="abh-card abh-spot abh-lift group flex flex-col p-5"
    >
      <div className="relative flex items-start gap-4">
        <div className="relative shrink-0">
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl opacity-60 blur-lg transition-opacity group-hover:opacity-100"
            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
          />
          <span
            aria-hidden
            className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
          >
            {initials || '·'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onView}
              className="truncate text-base font-semibold text-[var(--text)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              {app.name}
            </button>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              Ready
            </span>
          </div>
          <a
            href={app.base_url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--primary-strong)]"
          >
            <IconGlobe size={12} />
            <span className="truncate font-mono">{hostOf(app.base_url)}</span>
            <IconExternalLink size={10} className="opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
          {app.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-[var(--text-subtle)]">{app.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums leading-none text-[var(--text)]">
            {testCount === null ? '—' : testCount}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--text-subtle)]">Tests</div>
        </div>
      </div>

      {/* Progress through the workflow for this application */}
      <div className="relative mt-5 flex items-center gap-2">
        {stages.map((st, i) => (
          <div key={st.label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                st.done ? 'text-white' : 'border border-[var(--border)] text-[var(--text-subtle)]'
              }`}
              style={st.done ? { background: 'linear-gradient(135deg, var(--success), var(--secondary))' } : undefined}
            >
              {st.done ? <IconCheck size={11} /> : i + 1}
            </span>
            <span className={`hidden text-[11px] sm:inline ${st.done ? 'text-[var(--text-muted)]' : 'text-[var(--text-subtle)]'}`}>
              {st.label}
            </span>
            {i < stages.length - 1 && (
              <span className="h-px flex-1 overflow-hidden bg-[var(--border)]">
                {st.done && stages[i + 1]!.done && <span className="abh-grow-x block h-full bg-[var(--success)]" />}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <div className="text-xs text-[var(--text-subtle)]">
          {hasTests ? (
            <span>
              <span className="text-[var(--text-muted)]">{testCount} test{testCount === 1 ? '' : 's'} ready.</span> Run them from Tests.
            </span>
          ) : canWrite ? (
            <span>
              <span className="font-medium text-[var(--primary-strong)]">Next:</span> discover pages, then generate tests.
            </span>
          ) : (
            <span>Added {formatRelativeTime(app.created_at ?? null)}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canWrite && (
            <button
              type="button"
              onClick={onDiscover}
              className={`abh-btn abh-btn-sm ${hasTests ? 'abh-btn-ghost' : 'abh-btn-primary'}`}
            >
              <IconCompass size={12} />
              Discover
            </button>
          )}
          {hasTests && (
            <button type="button" onClick={onTests} className="abh-btn abh-btn-ghost abh-btn-sm">
              <IconSparkles size={12} />
              Tests
            </button>
          )}
          <button type="button" onClick={onView} className="abh-btn abh-btn-ghost abh-btn-sm">
            View
            <IconChevronRight size={12} />
          </button>
        </div>
      </div>
    </li>
  );
}
