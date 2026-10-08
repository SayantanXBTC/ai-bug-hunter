import type { ReactNode } from 'react';
import { useCountUp, useSpotlight } from '../../lib/motion.js';

export type MetricAccent = 'violet' | 'emerald' | 'red' | 'orange' | 'neutral' | 'cyan';

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: MetricAccent;
  index?: number;
  icon?: ReactNode;
  /** Makes the tile a button (e.g. to filter a list or open a page). */
  onClick?: () => void;
  /** Highlights the tile as the active filter. */
  active?: boolean;
}

export const ACCENT_COLOR: Record<MetricAccent, string> = {
  violet: '#8b5cf6',
  emerald: '#10b981',
  red: '#ef4444',
  orange: '#f59e0b',
  neutral: '#64748b',
  cyan: '#22d3ee',
};

/** Renders numbers with a count-up; anything else passes through unchanged. */
export function AnimatedValue({ value }: { value: ReactNode }): JSX.Element {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const animated = useCountUp(numeric ?? 0);
  if (numeric === null) return <>{value}</>;
  const isInt = Number.isInteger(numeric);
  return <>{isInt ? Math.round(animated).toLocaleString() : animated.toFixed(1)}</>;
}

export function MetricPanel({
  label,
  value,
  hint,
  accent = 'neutral',
  index = 0,
  icon,
  onClick,
  active = false,
}: Props): JSX.Element {
  const spot = useSpotlight();
  const color = ACCENT_COLOR[accent];
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': active } : {})}
      onMouseMove={spot}
      className={`abh-card abh-spot abh-lift group block w-full p-4 text-left ${
        onClick ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]' : ''
      }`}
      style={{
        animation: 'abhFadeUp 0.5s var(--ease-out) both',
        animationDelay: `${Math.min(index, 8) * 55}ms`,
        ...(active ? { borderColor: color, boxShadow: `0 0 0 1px ${color}55, 0 10px 30px -14px ${color}` } : {}),
      }}
    >
      {/* Accent glow in the corner */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25"
        style={{ background: color }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="relative flex h-1.5 w-1.5">
            {active && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ background: color }} />
            )}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          </span>
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--text-subtle)]">
            {label}
          </div>
        </div>
        {icon && (
          <span className="text-[var(--text-subtle)] transition-colors group-hover:text-[var(--text)]" style={{ color: active ? color : undefined }}>
            {icon}
          </span>
        )}
      </div>
      <div className="relative mt-2.5 text-[26px] font-semibold leading-none tabular-nums text-[var(--text)]">
        <AnimatedValue value={value} />
      </div>
      {hint && <div className="relative mt-1.5 text-xs text-[var(--text-muted)]">{hint}</div>}
      <span
        aria-hidden
        className="absolute inset-x-4 bottom-0 h-px origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
    </Tag>
  );
}
