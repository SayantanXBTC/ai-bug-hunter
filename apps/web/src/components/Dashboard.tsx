import { useEffect, useMemo, useState } from 'react';
import type { DashboardOverviewResponse, TrendMetric, TrendResponse } from '@ai-bug-hunter/shared';

const METRIC_OPTIONS: Array<{ value: TrendMetric; label: string }> = [
  { value: 'passRate', label: 'Pass rate' },
  { value: 'failureRate', label: 'Failure rate' },
  { value: 'flakyRate', label: 'Flaky rate' },
  { value: 'qualityScore', label: 'Quality score' },
  { value: 'bugCount', label: 'Bugs / day' },
  { value: 'regressionCount', label: 'Regressions / day' },
  { value: 'avgDuration', label: 'Avg duration (ms)' },
];

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}
function scoreLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 50) return 'At risk';
  return 'Critical';
}

function TrendChart({ trend }: { trend: TrendResponse }): JSX.Element {
  if (trend.insufficient) {
    return <div className="text-sm text-slate-500">Not enough historical data.</div>;
  }
  const width = 600, height = 140, pad = 24;
  const values = trend.buckets.map((b) => b.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const step = (width - pad * 2) / Math.max(1, trend.buckets.length - 1);
  const points = trend.buckets.map((b, i) => {
    const x = pad + i * step;
    const y = height - pad - ((b.value - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg
      role="img"
      aria-label={`${trend.metric} trend`}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full max-w-3xl h-40 rounded border bg-white"
    >
      <polyline fill="none" stroke="#0f766e" strokeWidth="2" points={points} />
      {trend.buckets.map((b, i) => {
        const x = pad + i * step;
        const y = height - pad - ((b.value - min) / range) * (height - pad * 2);
        return <circle key={b.startIso} cx={x} cy={y} r={2.5} fill="#0f766e" />;
      })}
      <text x={pad} y={height - 4} fontSize="10" fill="#64748b">
        {trend.buckets[0]?.startIso.slice(0, 10)}
      </text>
      <text x={width - pad} y={height - 4} fontSize="10" fill="#64748b" textAnchor="end">
        {trend.buckets[trend.buckets.length - 1]?.startIso.slice(0, 10)}
      </text>
    </svg>
  );
}

interface RecentBug {
  id: string;
  title: string;
  severity: string;
  status: string;
  lastSeenAt: string;
}

export function Dashboard(): JSX.Element {
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [metric, setMetric] = useState<TrendMetric>('passRate');
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [recentBugs, setRecentBugs] = useState<RecentBug[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/overview', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as DashboardOverviewResponse;
        if (!cancelled) setOverview(body);
      } catch (e) {
        if (!cancelled) setOverviewError(e instanceof Error ? e.message : 'error');
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/bug-intelligence/clusters?limit=5', { credentials: 'include' });
        if (res.ok) {
          const body = (await res.json()) as { items: RecentBug[] };
          if (!cancelled) setRecentBugs(body.items ?? []);
        }
      } catch {
        // ignore - non-critical
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
        const res = await fetch(`/api/dashboard/trends?metric=${metric}&window=30d`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as TrendResponse;
        if (!cancelled) {
          setTrend(body);
          setTrendError(null);
        }
      } catch (e) {
        if (!cancelled) setTrendError(e instanceof Error ? e.message : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [metric]);

  const score = overview?.qualityScore.score ?? 0;
  const scoreCls = useMemo(() => scoreColor(score), [score]);

  if (overviewError) {
    return <div className="text-sm text-rose-600">Failed to load dashboard: {overviewError}</div>;
  }
  if (!overview) {
    return <div className="text-sm text-slate-500">Loading dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-lg border p-6 shadow-sm ${scoreCls}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest">Quality Score</div>
            <div className="text-5xl font-bold">
              {overview.qualityScore.score}
              <span className="text-2xl text-slate-500">/100</span>
            </div>
            <div className="mt-1 text-sm">{scoreLabel(overview.qualityScore.score)}</div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Sample: {overview.qualityScore.sampleSize} runs</div>
            {overview.qualityScore.warning && (
              <div className="mt-1 text-amber-700">{overview.qualityScore.warning}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Recent tests" value={overview.testRuns.totalRecent} sub={`${overview.testRuns.passed} passed`} />
        <KpiCard label="Open bugs" value={overview.bugs.openClusters} sub={`${overview.bugs.regressed} regressed`} />
        <KpiCard label="Flaky tests" value={overview.flakyTests.count} />
        <KpiCard label="Applications" value={overview.applications.count} />
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">Quality Trends</h2>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as TrendMetric)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            aria-label="Trend metric"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {trendError && <div className="text-sm text-rose-600">Failed to load trend: {trendError}</div>}
        {!trendError && !trend && <div className="text-sm text-slate-500">Loading…</div>}
        {trend && <TrendChart trend={trend} />}
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Recent regression campaign</h2>
        {overview.recentCampaign ? (
          <div className="text-sm text-slate-700">
            <div className="font-medium">{overview.recentCampaign.name}</div>
            <div className="text-slate-500">
              Quality: <span className="font-medium">{overview.recentCampaign.quality ?? 'n/a'}</span>{' '}
              — {overview.recentCampaign.passed} passed, {overview.recentCampaign.failed} failed
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">No campaigns yet.</div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Recent bugs</h2>
        {recentBugs.length === 0 ? (
          <div className="text-sm text-slate-500">No bugs to show.</div>
        ) : (
          <ul className="divide-y">
            {recentBugs.slice(0, 5).map((b) => (
              <li key={b.id} className="py-2 text-sm">
                <span className="font-medium text-slate-800">{b.title}</span>{' '}
                <span className="text-slate-500">— {b.severity} · {b.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: number; sub?: string }): JSX.Element {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-3xl font-semibold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
