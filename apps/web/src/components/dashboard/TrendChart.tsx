import { useEffect, useMemo, useState } from 'react';
import type { TrendMetric, TrendResponse } from '@ai-bug-hunter/shared';

const METRIC_OPTIONS: Array<{ value: TrendMetric; label: string }> = [
  { value: 'qualityScore', label: 'Quality Score' },
  { value: 'passRate', label: 'Pass Rate' },
  { value: 'failureRate', label: 'Failure Rate' },
  { value: 'flakyRate', label: 'Flaky Rate' },
  { value: 'bugCount', label: 'Bug Count' },
  { value: 'avgDuration', label: 'Avg Duration' },
];

const WINDOWS: Array<'7d' | '30d' | '90d'> = ['7d', '30d', '90d'];

interface TrendChartSectionProps {
  applicationId?: string | null;
}

function formatYValue(metric: TrendMetric, value: number): string {
  switch (metric) {
    case 'passRate':
    case 'failureRate':
    case 'flakyRate':
      return `${(value * 100).toFixed(0)}%`;
    case 'avgDuration':
      return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
    case 'qualityScore':
      return String(Math.round(value));
    default:
      return String(Math.round(value));
  }
}

export function TrendChartSection({ applicationId }: TrendChartSectionProps): JSX.Element {
  const [metric, setMetric] = useState<TrendMetric>('qualityScore');
  const [window, setWindow] = useState<'7d' | '30d' | '90d'>('30d');
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ metric, window });
    if (applicationId) params.set('applicationId', applicationId);
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/trends?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as TrendResponse;
        if (!cancelled) {
          setTrend(body);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load trend');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [metric, window, applicationId]);

  const chart = useMemo(() => {
    if (!trend || trend.buckets.length === 0) return null;
    const width = 800;
    const height = 260;
    const padL = 44, padR = 16, padT = 16, padB = 32;
    const values = trend.buckets.map((b) => b.value);
    const rawMax = Math.max(...values);
    const rawMin = Math.min(...values);
    const isRateMetric =
      metric === 'passRate' || metric === 'failureRate' || metric === 'flakyRate';
    const isScore = metric === 'qualityScore';
    const max = isRateMetric ? 1 : isScore ? 100 : Math.max(rawMax * 1.1, 1);
    const min = isRateMetric || isScore ? 0 : Math.min(rawMin, 0);
    const range = max - min || 1;
    const n = trend.buckets.length;
    const step = n === 1 ? 0 : (width - padL - padR) / (n - 1);
    const points = trend.buckets.map((b, i) => {
      const x = padL + i * step;
      const y = padT + (1 - (b.value - min) / range) * (height - padT - padB);
      return { x, y, value: b.value, startIso: b.startIso };
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => padT + t * (height - padT - padB));
    return { width, height, padL, padR, padT, padB, min, max, points, path, gridYs };
  }, [trend, metric]);

  const firstDate = trend?.buckets[0]?.startIso.slice(0, 10);
  const lastDate = trend?.buckets[trend.buckets.length - 1]?.startIso.slice(0, 10);

  return (
    <section className="abh-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Quality Trend</h2>
          <p className="text-xs text-[var(--text-muted)]">How the selected signal moved over time. Hover the line for exact values.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="trend-metric">Metric</label>
          <select
            id="trend-metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as TrendMetric)}
            className="abh-input w-auto py-1.5"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div role="group" aria-label="Time window" className="relative inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-0.5">
            <span
              aria-hidden
              className="absolute inset-y-0.5 rounded-lg transition-all duration-300"
              style={{
                width: 'calc((100% - 4px) / 3)',
                left: `calc(2px + ${WINDOWS.indexOf(window)} * (100% - 4px) / 3)`,
                background: 'linear-gradient(135deg, var(--primary), #6d28d9)',
                boxShadow: '0 4px 14px -6px var(--primary)',
              }}
            />
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                aria-pressed={window === w}
                className={`relative z-10 w-11 py-1 text-xs font-medium tabular-nums transition-colors ${
                  window === w ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-[280px]">
        {loading && <div className="abh-skeleton h-full w-full rounded-xl" />}
        {!loading && error && (
          <div className="flex h-full items-center justify-center text-sm text-red-600">
            {error}
          </div>
        )}
        {!loading && !error && trend && (trend.insufficient || !chart) && (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] text-center">
            <svg width="180" height="60" viewBox="0 0 180 60" aria-hidden>
              <path
                d="M0 45 C 30 40, 40 20, 70 28 S 120 50, 140 22 S 170 10, 180 14"
                fill="none"
                stroke="var(--primary)"
                strokeOpacity="0.5"
                strokeWidth="2"
                strokeDasharray="4 6"
              />
            </svg>
            <div className="text-sm text-[var(--text-muted)]">The trend line appears once runs span a few days.</div>
            <div className="text-xs text-[var(--text-subtle)]">Keep running tests; each day adds a data point.</div>
          </div>
        )}
        {!loading && !error && trend && !trend.insufficient && chart && (
          <>
            <svg
              role="img"
              aria-label={`${metric} over ${window}`}
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              className="h-full w-full"
              preserveAspectRatio="none"
              onMouseLeave={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--primary)" stopOpacity="0.35" />
                  <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="trend-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="var(--primary)" />
                  <stop offset="1" stopColor="var(--secondary)" />
                </linearGradient>
              </defs>
              {chart.gridYs.map((y, i) => (
                <line
                  key={i}
                  x1={chart.padL}
                  x2={chart.width - chart.padR}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray="3 5"
                />
              ))}
              <text x={chart.padL - 6} y={chart.padT + 4} fontSize="10" fill="var(--text-subtle)" textAnchor="end">
                {formatYValue(metric, chart.max)}
              </text>
              <text x={chart.padL - 6} y={chart.height - chart.padB} fontSize="10" fill="var(--text-subtle)" textAnchor="end">
                {formatYValue(metric, chart.min)}
              </text>
              {chart.points.length > 1 && (
                <path
                  key={`area-${metric}-${window}`}
                  className="abh-fade-in"
                  d={`${chart.path} L${chart.points[chart.points.length - 1]!.x},${chart.height - chart.padB} L${chart.points[0]!.x},${chart.height - chart.padB} Z`}
                  fill="url(#trend-area)"
                />
              )}
              <path
                key={`line-${metric}-${window}`}
                d={chart.path}
                fill="none"
                stroke="url(#trend-line)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset="1"
                style={{ animation: 'abhDash 1.2s var(--ease-out) forwards' }}
              />
              {hoverIdx !== null && chart.points[hoverIdx] && (
                <line
                  x1={chart.points[hoverIdx]!.x}
                  x2={chart.points[hoverIdx]!.x}
                  y1={chart.padT}
                  y2={chart.height - chart.padB}
                  stroke="var(--primary)"
                  strokeOpacity="0.4"
                  strokeDasharray="3 3"
                />
              )}
              {chart.points.map((p, i) => (
                <g key={p.startIso}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoverIdx === i ? 5 : 3}
                    fill="var(--surface)"
                    stroke={hoverIdx === i ? 'var(--secondary)' : 'var(--primary)'}
                    strokeWidth={2}
                  />
                  <rect
                    x={p.x - (chart.points[1] ? (chart.points[1].x - chart.points[0]!.x) / 2 : 20)}
                    y={chart.padT}
                    width={
                      chart.points[1] ? chart.points[1].x - chart.points[0]!.x : 40
                    }
                    height={chart.height - chart.padT - chart.padB}
                    fill="transparent"
                    onMouseEnter={() => setHoverIdx(i)}
                  />
                </g>
              ))}
              {firstDate && (
                <text x={chart.padL} y={chart.height - 8} fontSize="10" fill="var(--text-subtle)">
                  {firstDate}
                </text>
              )}
              {lastDate && lastDate !== firstDate && (
                <text
                  x={chart.width - chart.padR}
                  y={chart.height - 8}
                  fontSize="10"
                  fill="var(--text-subtle)"
                  textAnchor="end"
                >
                  {lastDate}
                </text>
              )}
            </svg>
            {hoverIdx !== null && chart.points[hoverIdx] && (
              <div
                role="tooltip"
                className="abh-scale-in pointer-events-none absolute z-10 rounded-lg border border-[var(--border-strong)] px-2.5 py-1.5 text-xs text-[var(--text)] shadow-[var(--shadow)] backdrop-blur-md"
                style={{
                  background: 'var(--surface-glass)',
                  left: `calc(${(chart.points[hoverIdx]!.x / chart.width) * 100}% + 10px)`,
                  top: `calc(${(chart.points[hoverIdx]!.y / chart.height) * 100}% - 12px)`,
                }}
              >
                <div className="font-semibold tabular-nums">
                  {formatYValue(metric, chart.points[hoverIdx]!.value)}
                </div>
                <div className="text-[var(--text-muted)]">
                  {chart.points[hoverIdx]!.startIso.slice(0, 10)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
