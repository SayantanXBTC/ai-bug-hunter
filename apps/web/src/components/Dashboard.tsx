import { useCallback, useEffect, useState } from 'react';
import type { DashboardOverviewResponse } from '@ai-bug-hunter/shared';
import { useAuth } from '../hooks/useAuth.js';
import { IconBug, IconCheckCircle, IconClock, IconRadar, IconRefresh } from './icons.js';
import { formatPercent, formatDuration } from '../lib/format.js';
import { MetricCard } from './dashboard/MetricCard.js';
import { QualityScoreCard } from './dashboard/QualityScoreCard.js';
import { TrendChartSection } from './dashboard/TrendChart.js';
import { RecentFailures } from './dashboard/RecentFailures.js';
import { BugIntelligenceSection } from './dashboard/BugIntelligenceSection.js';
import { SkeletonCard } from './dashboard/Skeleton.js';
import { DashboardError } from './dashboard/DashboardError.js';
import { GettingStarted } from './dashboard/GettingStarted.js';
import type { PageAction, ViewId } from './navigation.js';
import { UserAvatar, firstNameOf } from './shared/UserAvatar.js';

interface AppOption {
  id: string;
  name: string;
}

type NavigateFn = (target: ViewId, action?: PageAction) => void;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

interface DashboardProps {
  onNavigate?: NavigateFn;
}

interface OverviewState {
  data: DashboardOverviewResponse | null;
  loading: boolean;
  error: string | null;
  requestId?: string | null;
}

export function Dashboard({ onNavigate }: DashboardProps = {}): JSX.Element {
  const auth = useAuth();
  const canWrite = auth.user?.role === 'admin' || auth.user?.role === 'qa_engineer';
  const [applicationId, setApplicationId] = useState<string | ''>('');
  const [apps, setApps] = useState<AppOption[]>([]);
  const [state, setState] = useState<OverviewState>({ data: null, loading: true, error: null });
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [testCount, setTestCount] = useState<number | null>(null);

  const fetchOverview = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    setState((s) => ({ ...s, loading: s.data === null, error: null }));
    try {
      const url = applicationId
        ? `/api/dashboard/overview?applicationId=${encodeURIComponent(applicationId)}`
        : '/api/dashboard/overview';
      const res = await fetch(url, { credentials: 'include' });
      const requestId = res.headers.get('x-request-id');
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string; message?: string };
          if (body?.error) msg = body.error;
          else if (body?.message) msg = body.message;
        } catch {
          // ignore parse failures
        }
        setState({ data: null, loading: false, error: msg, requestId });
        return;
      }
      const body = (await res.json()) as DashboardOverviewResponse;
      setState({ data: body, loading: false, error: null, requestId });
    } catch (e) {
      setState({
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load overview',
      });
    } finally {
      setRefreshing(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/applications?limit=100', { credentials: 'include' });
        if (!res.ok) return;
        const body = (await res.json()) as { items?: AppOption[] };
        if (!cancelled && Array.isArray(body.items)) {
          setApps(body.items.map((a) => ({ id: a.id, name: a.name })));
        }
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/test-cases?limit=1', { credentials: 'include' });
        if (!res.ok) return;
        const body = (await res.json()) as { total?: number };
        if (!cancelled && typeof body.total === 'number') setTestCount(body.total);
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const overview = state.data;
  const testRuns = overview?.testRuns;
  const passRate =
    testRuns && testRuns.totalRecent > 0
      ? testRuns.passed / testRuns.totalRecent
      : null;
  // The API surfaces "insufficient" indirectly via sampleSize/warning; we treat sampleSize === 0 as insufficient.
  const qualityInsufficient = overview ? overview.qualityScore.sampleSize === 0 : false;


  const summary = (() => {
    if (!overview) return null;
    if (!testRuns || testRuns.totalRecent === 0) {
      return overview.applications.count === 0
        ? 'Nothing is being tested yet. Start by adding the application you want to protect.'
        : 'Your applications are registered. Generate and run tests to start measuring quality.';
    }
    const pct = Math.round((testRuns.passed / testRuns.totalRecent) * 100);
    const parts = [`${pct}% of your last ${testRuns.totalRecent} run${testRuns.totalRecent === 1 ? '' : 's'} passed`];
    parts.push(
      overview.bugs.openClusters > 0
        ? `${overview.bugs.openClusters} bug cluster${overview.bugs.openClusters === 1 ? '' : 's'} need attention`
        : 'no unresolved bug clusters',
    );
    if (overview.flakyTests.count > 0) parts.push(`${overview.flakyTests.count} flaky`);
    return `${parts.join(' · ')}.`;
  })();

  return (
    <div className="space-y-6">
      <header className="abh-fade-up flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.24em] text-[var(--text-subtle)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            </span>
            QA Overview
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            {auth.user && (
              <UserAvatar user={auth.user} size={40} rounded="rounded-full" className="ring-2 ring-[var(--border-strong)]" />
            )}
            <h1 className="text-[26px] leading-tight tracking-tight text-[var(--text)]" style={{ fontFamily: 'var(--font-heading)' }}>
              {greeting()}, {firstNameOf(auth.user)}
            </h1>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {summary ?? 'Application quality, test health, and AI-assisted defect intelligence.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {apps.length > 0 && (
            <>
              <label htmlFor="app-filter" className="sr-only">Filter by application</label>
              <select
                id="app-filter"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="abh-input w-auto"
              >
                <option value="">All applications</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={refreshing}
            className="abh-btn abh-btn-ghost"
            aria-label="Refresh"
          >
            <IconRefresh size={14} className={refreshing ? 'animate-spin' : undefined} />
          </button>
        </div>
      </header>

      {state.error && !state.loading && !overview && (
        <DashboardError
          message={state.error}
          requestId={state.requestId ?? null}
          onRetry={() => setRefreshTick((t) => t + 1)}
        />
      )}

      {overview && (
        <GettingStarted
          canWrite={canWrite}
          onGo={(v, a) => onNavigate?.(v, a)}
          state={{
            apps: overview.applications.count,
            tests: testCount,
            runs: overview.testRuns.totalRecent,
            campaigns: overview.recentCampaign !== null,
          }}
        />
      )}

      {(state.loading && !overview) ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <SkeletonCard />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:col-span-2">
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      ) : overview ? (
        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="lg:col-span-1">
            <QualityScoreCard quality={overview.qualityScore} insufficient={qualityInsufficient} />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:col-span-2">
            <MetricCard
              index={0}
              label="Pass Rate"
              value={passRate === null ? '—' : formatPercent(passRate)}
              hint={testRuns ? `${testRuns.passed}/${testRuns.totalRecent} recent` : undefined}
              icon={<IconCheckCircle size={16} />}
              color="#10b981"
              onClick={() => onNavigate?.('test-runs')}
              actionLabel="Runs"
            />
            <MetricCard
              index={1}
              label="Open Bugs"
              value={overview.bugs.openClusters}
              hint={overview.bugs.regressed > 0 ? `${overview.bugs.regressed} regressed` : 'clusters'}
              icon={<IconBug size={16} />}
              color="#ef4444"
              onClick={() => onNavigate?.('bugs')}
              actionLabel="Bugs"
            />
            <MetricCard
              index={2}
              label="Flaky Tests"
              value={overview.flakyTests.count}
              hint="from reliability snapshots"
              icon={<IconRadar size={16} />}
              color="#f59e0b"
              onClick={() => onNavigate?.('reliability')}
              actionLabel="Reliability"
            />
            <MetricCard
              index={3}
              label="Tests Executed"
              value={testRuns?.totalRecent ?? 0}
              hint={testRuns ? `avg ${formatDuration(testRuns.avgDurationMs)}` : undefined}
              icon={<IconClock size={16} />}
              color="#22d3ee"
              onClick={() => onNavigate?.('test-runs')}
              actionLabel="Runs"
            />
          </div>
        </div>
      ) : null}

      {overview && <TrendChartSection applicationId={applicationId || null} />}

      {overview && (
        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <RecentFailures onOpenRuns={() => onNavigate?.('test-runs')} canWrite={canWrite} />
          <BugIntelligenceSection onOpenBugs={() => onNavigate?.('bugs')} />
        </div>
      )}

    </div>
  );
}
