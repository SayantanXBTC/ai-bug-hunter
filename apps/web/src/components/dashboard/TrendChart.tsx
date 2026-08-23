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
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">Quality Trend</h2>
          <p className="text-xs text-neutral-500">Historical view of key quality signals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="trend-metric">Metric</label>
          <select
            id="trend-metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as TrendMetric)}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div role="group" aria-label="Time window" className="inline-flex overflow-hidden rounded border border-neutral-300">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                aria-pressed={window === w}
                className={`px-2.5 py-1 text-xs font-medium tabular-nums ${
                  window === w
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-[280px]">
        {loading && (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            Loading trend…
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full items-center justify-center text-sm text-red-600">
            {error}
          </div>
        )}
        {!loading && !error && trend && (trend.insufficient || !chart) && (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            Not enough historical data yet.
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
              {chart.gridYs.map((y, i) => (
                <line
                  key={i}
                  x1={chart.padL}
                  x2={chart.width - chart.padR}
                  y1={y}
                  y2={y}
                  stroke="#e5e5e5"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ))}
              <text
                x={chart.padL - 6}
                y={chart.padT + 4}
                fontSize="10"
                fill="#a3a3a3"
                textAnchor="end"
              >
                {formatYValue(metric, chart.max)}
              </text>
              <text
                x={chart.padL - 6}
                y={chart.height - chart.padB}
                fontSize="10"
                fill="#a3a3a3"
                textAnchor="end"
              >
                {formatYValue(metric, chart.min)}
              </text>
              <path d={chart.path} fill="none" stroke="#171717" strokeWidth={2} />
              {chart.points.map((p, i) => (
                <g key={p.startIso}>
                  <circle cx={p.x} cy={p.y} r={2.5} fill="#171717" />
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
                <text x={chart.padL} y={chart.height - 8} fontSize="10" fill="#a3a3a3">
                  {firstDate}
                </text>
              )}
              {lastDate && lastDate !== firstDate && (
                <text
                  x={chart.width - chart.padR}
                  y={chart.height - 8}
                  fontSize="10"
                  fill="#a3a3a3"
                  textAnchor="end"
                >
                  {lastDate}
                </text>
              )}
            </svg>
            {hoverIdx !== null && chart.points[hoverIdx] && (
              <div
                role="tooltip"
                className="pointer-events-none absolute z-10 rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm"
                style={{
                  left: `calc(${(chart.points[hoverIdx]!.x / chart.width) * 100}% + 8px)`,
                  top: `calc(${(chart.points[hoverIdx]!.y / chart.height) * 100}% - 8px)`,
                }}
              >
                <div className="font-medium tabular-nums">
                  {formatYValue(metric, chart.points[hoverIdx]!.value)}
                </div>
                <div className="text-neutral-500">
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
