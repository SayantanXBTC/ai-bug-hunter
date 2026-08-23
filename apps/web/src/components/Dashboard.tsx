import { useCallback, useEffect, useState } from 'react';
import type { DashboardOverviewResponse } from '@ai-bug-hunter/shared';
import { useAuth } from '../hooks/useAuth.js';
import { IconRefresh, IconSparkles } from './icons.js';
import { formatNumber, formatPercent, formatDuration } from '../lib/format.js';
import { MetricCard } from './dashboard/MetricCard.js';
import { QualityScoreCard } from './dashboard/QualityScoreCard.js';
import { TrendChartSection } from './dashboard/TrendChart.js';
import { RecentFailures } from './dashboard/RecentFailures.js';
import { BugIntelligenceSection } from './dashboard/BugIntelligenceSection.js';
import { AiActivitySection } from './dashboard/AiActivitySection.js';
import { RecentRunsTable } from './dashboard/RecentRunsTable.js';
import { QuickActions } from './dashboard/QuickActions.js';
import { SkeletonCard } from './dashboard/Skeleton.js';
import { DashboardError } from './dashboard/DashboardError.js';

interface AppOption {
  id: string;
  name: string;
}

type NavigateFn = (target: 'applications' | 'tests' | 'test-runs' | 'bugs' | 'regression') => void;

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

  const overview = state.data;
  const testRuns = overview?.testRuns;
  const passRate =
    testRuns && testRuns.totalRecent > 0
      ? testRuns.passed / testRuns.totalRecent
      : null;
  // The API surfaces "insufficient" indirectly via sampleSize/warning; we treat sampleSize === 0 as insufficient.
  const qualityInsufficient = overview ? overview.qualityScore.sampleSize === 0 : false;

  const investigationCount = (() => {
    if (!overview) return 0;
    const extended = overview.aiMetrics as unknown as {
      byOperation?: Record<string, { count: number }>;
    };
    const inv = extended.byOperation?.investigation?.count;
    return typeof inv === 'number' ? inv : overview.aiMetrics.requestCount;
  })();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">QA Overview</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Application quality, test health, and AI-assisted defect intelligence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {apps.length > 0 && (
            <>
              <label htmlFor="app-filter" className="sr-only">Filter by application</label>
              <select
                id="app-filter"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400"
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
            className="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-60"
          >
            <IconRefresh size={14} className={refreshing ? 'animate-spin' : undefined} />
            Refresh
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

      {(state.loading && !overview) ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="h-full rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <SkeletonCard />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-2">
            {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      ) : overview ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <QualityScoreCard quality={overview.qualityScore} insufficient={qualityInsufficient} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-2">
            <MetricCard
              label="Pass Rate"
              value={passRate === null ? '—' : formatPercent(passRate)}
              hint={testRuns ? `${testRuns.passed}/${testRuns.totalRecent} recent` : undefined}
            />
            <MetricCard
              label="Open Bugs"
              value={formatNumber(overview.bugs.openClusters)}
              hint={overview.bugs.regressed > 0 ? `${overview.bugs.regressed} regressed` : 'clusters'}
            />
            <MetricCard
              label="Flaky Tests"
              value={formatNumber(overview.flakyTests.count)}
              hint="from reliability snapshots"
            />
            <MetricCard
              label="Tests Executed"
              value={formatNumber(testRuns?.totalRecent ?? 0)}
              hint={testRuns ? `avg ${formatDuration(testRuns.avgDurationMs)}` : undefined}
            />
            <MetricCard
              label="Applications"
              value={formatNumber(overview.applications.count)}
              hint="registered"
            />
            <MetricCard
              label="AI Investigations"
              value={formatNumber(investigationCount)}
              hint={overview.aiMetrics.provider ?? 'AI-assisted'}
              aiAccent
            />
          </div>
        </div>
      ) : null}

      {overview && <TrendChartSection applicationId={applicationId || null} />}

      {overview && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentFailures onOpenRuns={() => onNavigate?.('test-runs')} canWrite={canWrite} />
          <BugIntelligenceSection onOpenBugs={() => onNavigate?.('bugs')} />
        </div>
      )}

      {overview && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentRunsTable onOpenRun={() => onNavigate?.('test-runs')} />
          </div>
          <AiActivitySection aiMetrics={overview.aiMetrics} />
        </div>
      )}

      {overview && (
        <QuickActions
          canWrite={canWrite}
          onDiscover={() => onNavigate?.('applications')}
          onGenerate={() => onNavigate?.('tests')}
          onRun={() => onNavigate?.('test-runs')}
          onRegression={() => onNavigate?.('regression')}
        />
      )}

      {overview && (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
          <span className="flex items-center gap-1">
            <IconSparkles size={12} className="text-violet-500" /> indicates AI-assisted signal
          </span>
        </div>
      )}
    </div>
  );
}
