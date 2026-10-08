import { useState } from 'react';
import type { QualityScoreBreakdown, QualityScoreResult } from '@ai-bug-hunter/shared';
import { useCountUp } from '../../lib/motion.js';
import { AnimatedValue } from '../shared/MetricPanel.js';

interface QualityScoreCardProps {
  quality: QualityScoreResult | null;
  insufficient?: boolean;
}

function toneFor(score: number): { label: string; color: string; badge: string } {
  if (score >= 80)
    return { label: 'Good', color: '#10b981', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  if (score >= 50)
    return { label: 'Fair', color: '#f59e0b', badge: 'border-amber-200 bg-amber-50 text-amber-700' };
  return { label: 'Needs attention', color: '#ef4444', badge: 'border-red-200 bg-red-50 text-red-700' };
}

/** Max points each component can move the score (mirrors the API's weights). */
const COMPONENTS: Array<{ key: keyof QualityScoreBreakdown; label: string; weight: number }> = [
  { key: 'passRate', label: 'Pass rate', weight: 40 },
  { key: 'criticalFailures', label: 'Critical failures', weight: 20 },
  { key: 'regressions', label: 'Regressions', weight: 15 },
  { key: 'flaky', label: 'Flaky tests', weight: 10 },
  { key: 'openBugSeverity', label: 'Bug severity', weight: 10 },
  { key: 'campaignHealth', label: 'Campaign health', weight: 5 },
];

export function QualityScoreCard({ quality, insufficient }: QualityScoreCardProps): JSX.Element {
  const hasData = !!quality && !insufficient && quality.sampleSize > 0;
  const score = quality?.score ?? 0;
  const tone = toneFor(score);
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, hasData ? score : 0));
  const animated = useCountUp(clamped, 1400);
  const dash = (animated / 100) * circumference;
  const [hover, setHover] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const breakdown = quality?.breakdown as Partial<QualityScoreBreakdown> | undefined;
  const rows = COMPONENTS.filter((c) => breakdown?.[c.key]);

  return (
    <div className="abh-card abh-spot relative flex h-full flex-col overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: hasData ? tone.color : 'var(--primary)', opacity: 0.12 }}
      />
      <div className="relative flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Quality Score
        </div>
        {hasData ? (
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone.badge}`}>{tone.label}</span>
        ) : (
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            No data yet
          </span>
        )}
      </div>

      <div className="relative mt-5 flex items-center gap-6">
        <div className="relative shrink-0">
          <svg
            width={156}
            height={156}
            viewBox="0 0 156 156"
            role="img"
            aria-label={hasData ? `Quality score ${score} of 100` : 'Quality score unavailable'}
          >
            <defs>
              <linearGradient id="qs-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={tone.color} />
                <stop offset="1" stopColor="var(--secondary)" />
              </linearGradient>
              <filter id="qs-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* tick marks */}
            {Array.from({ length: 40 }).map((_, i) => {
              const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
              const on = hasData && i / 40 < animated / 100;
              return (
                <line
                  key={i}
                  x1={78 + Math.cos(a) * 74}
                  y1={78 + Math.sin(a) * 74}
                  x2={78 + Math.cos(a) * 77}
                  y2={78 + Math.sin(a) * 77}
                  stroke={on ? tone.color : 'var(--border)'}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx={78} cy={78} r={radius} stroke="var(--surface-hover)" strokeWidth={10} fill="none" />
            {hasData && (
              <circle
                cx={78}
                cy={78}
                r={radius}
                stroke="url(#qs-ring)"
                strokeWidth={10}
                strokeLinecap="round"
                fill="none"
                filter="url(#qs-glow)"
                strokeDasharray={`${dash} ${circumference}`}
                transform="rotate(-90 78 78)"
              />
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div
              className={`text-[42px] font-semibold leading-none tabular-nums ${hasData ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]'}`}
            >
              <AnimatedValue value={hasData ? score : 0} />
            </div>
            <div className="mt-1 text-xs text-[var(--text-subtle)]">/ 100</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {hasData ? (
            <>
              <div className="text-sm text-[var(--text-muted)]">
                Based on {quality!.sampleSize} recent test run{quality!.sampleSize === 1 ? '' : 's'}.
              </div>
              {quality!.warning && <div className="mt-2 text-xs text-amber-700">{quality!.warning}</div>}
            </>
          ) : (
            <div className="text-sm text-[var(--text-muted)]">
              Not enough historical data yet. Run your first test to begin measuring application quality.
            </div>
          )}
        </div>
      </div>

      {hasData && rows.length > 0 && (
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          aria-expanded={showWhy}
          className="relative mt-5 flex items-center gap-1.5 self-start text-xs text-[var(--text-subtle)] transition-colors hover:text-[var(--text)]"
        >
          <span className={`inline-block transition-transform duration-300 ${showWhy ? 'rotate-90' : ''}`}>›</span>
          Why this score?
        </button>
      )}
      {hasData && rows.length > 0 && showWhy && (
        <div className="abh-fade-up relative mt-3 space-y-2.5 border-t border-[var(--border)] pt-4">
          {rows.map((c, i) => {
            const comp = breakdown![c.key]!;
            const v = comp.weightedContribution;
            const positive = v >= 0;
            const pct = Math.min(100, (Math.abs(v) / c.weight) * 100);
            return (
              <div
                key={c.key}
                onMouseEnter={() => setHover(c.key)}
                onMouseLeave={() => setHover(null)}
                className="group"
                title={comp.explanation}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)] group-hover:text-[var(--text)]">{c.label}</span>
                  <span
                    className="tabular-nums"
                    style={{ color: v === 0 ? 'var(--text-subtle)' : positive ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {v > 0 ? '+' : ''}
                    {v.toFixed(1)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <div
                    className="abh-grow-x h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      animationDelay: `${200 + i * 80}ms`,
                      background: positive
                        ? 'linear-gradient(90deg, var(--success), var(--secondary))'
                        : 'linear-gradient(90deg, var(--danger), var(--warning))',
                    }}
                  />
                </div>
                {hover === c.key && comp.explanation && (
                  <div className="abh-fade-in mt-1 text-[11px] text-[var(--text-subtle)]">{comp.explanation}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
