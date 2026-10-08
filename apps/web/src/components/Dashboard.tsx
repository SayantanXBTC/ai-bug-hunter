import { useCallback, useEffect, useState } from 'react';
import type { DashboardOverviewResponse } from '@ai-bug-hunter/shared';
import { useAuth } from '../hooks/useAuth.js';
import {
  IconActivity,
  IconBug,
  IconCheckCircle,
  IconClock,
  IconLayers,
  IconRadar,
  IconRefresh,
  IconSparkles,
} from './icons.js';
import { formatPercent, formatDuration } from '../lib/format.js';
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
import { GettingStarted } from './dashboard/GettingStarted.js';
import type { PageAction, ViewId } from './navigation.js';

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

function displayName(email: string | undefined): string {
  if (!email) return 'there';
  const local = email.split('@')[0] ?? '';
  const first = local.split(/[._\-+0-9]+/).filter(Boolean)[0] ?? local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'there';
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

  const investigationCount = (() => {
    if (!overview) return 0;
    const extended = overview.aiMetrics as unknown as {
      byOperation?: Record<string, { count: number }>;
    };
    const inv = extended.byOperation?.investigation?.count;
    return typeof inv === 'number' ? inv : overview.aiMetrics.requestCount;
  })();

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
      <header className="abh-card abh-fade-up relative overflow-hidden p-6 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(500px 220px at 0% 0%, var(--primary-soft), transparent 70%), radial-gradient(400px 200px at 100% 100%, var(--secondary-soft), transparent 70%)',
          }}
        />
        <svg aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-40" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--primary)" strokeOpacity="0.4" strokeDasharray="2 8" className="abh-spin-slow" style={{ transformOrigin: '100px 100px' }} />
          <circle cx="100" cy="100" r="55" fill="none" stroke="var(--secondary)" strokeOpacity="0.35" strokeDasharray="1 6" className="abh-spin-slow" style={{ transformOrigin: '100px 100px', animationDirection: 'reverse' }} />
          <circle cx="180" cy="100" r="3" fill="var(--primary)" className="abh-spin-slow" style={{ transformOrigin: '100px 100px' }} />
        </svg>
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 max-w-2xl">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--text-subtle)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
              </span>
              QA Overview · live
            </div>
            <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-[var(--text)] sm:text-[32px]" style={{ fontFamily: 'var(--font-heading)' }}>
              {greeting()}, <span className="abh-gradient-text">{displayName(auth.user?.email)}</span>
            </h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
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
            >
              <IconRefresh size={14} className={refreshing ? 'animate-spin' : undefined} />
              Refresh
            </button>
          </div>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-2">
            {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      ) : overview ? (
        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="lg:col-span-1">
            <QualityScoreCard quality={overview.qualityScore} insufficient={qualityInsufficient} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-2">
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
            <MetricCard
              index={4}
              label="Applications"
              value={overview.applications.count}
              hint="registered"
              icon={<IconLayers size={16} />}
              color="#8b5cf6"
              onClick={() => onNavigate?.('applications')}
              actionLabel="Apps"
            />
            <MetricCard
              index={5}
              label="AI Investigations"
              value={investigationCount}
              hint={overview.aiMetrics.provider ?? 'AI-assisted'}
              icon={<IconSparkles size={16} />}
              color="#a855f7"
              aiAccent
              onClick={() => onNavigate?.('bugs')}
              actionLabel="Bugs"
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

      {overview && (
        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="lg:col-span-2">
            <RecentRunsTable onOpenRun={() => onNavigate?.('test-runs')} />
          </div>
          <AiActivitySection aiMetrics={overview.aiMetrics} />
        </div>
      )}

      {overview && (
        <QuickActions
          canWrite={canWrite}
          onDiscover={() => onNavigate?.('applications', 'add-application')}
          onGenerate={() => onNavigate?.('tests', 'generate-tests')}
          onRun={() => onNavigate?.('tests')}
          onRegression={() => onNavigate?.('regression', 'create-campaign')}
        />
      )}

      {overview && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-subtle)]">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
          <span className="flex items-center gap-1">
            <IconSparkles size={12} className="text-violet-500" /> indicates AI-assisted signal
            <IconActivity size={12} className="ml-3" /> click any metric to open its page
          </span>
        </div>
      )}
    </div>
  );
}
