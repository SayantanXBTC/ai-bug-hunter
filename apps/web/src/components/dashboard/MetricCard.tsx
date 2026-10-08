import type { ReactNode } from 'react';
import { useSpotlight } from '../../lib/motion.js';
import { AnimatedValue } from '../shared/MetricPanel.js';
import { IconChevronRight } from '../icons.js';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  aiAccent?: boolean;
  icon?: ReactNode;
  /** Accent colour for the icon tile and hover glow. */
  color?: string;
  index?: number;
  /** When set the card becomes a button that opens the related page. */
  onClick?: () => void;
  actionLabel?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  aiAccent = false,
  icon,
  color = '#8b5cf6',
  index = 0,
  onClick,
  actionLabel,
}: MetricCardProps): JSX.Element {
  const spot = useSpotlight();
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      onMouseMove={spot}
      className={`abh-card abh-spot abh-lift group flex w-full flex-col p-5 text-left ${
        aiAccent ? 'abh-glow-border' : ''
      } ${onClick ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]' : ''}`}
      style={{ animation: 'abhFadeUp 0.5s var(--ease-out) both', animationDelay: `${index * 60}ms` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: color }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {aiAccent && <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />}
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {label}
          </div>
        </div>
        {icon && (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
            style={{ background: `${color}1f`, color }}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="relative mb-2 mt-4 text-3xl font-semibold leading-none tabular-nums text-[var(--text)]">
        <AnimatedValue value={value} />
      </div>
      <div className="relative mt-auto flex items-center justify-between gap-2 pt-2">
        {hint ? <div className="text-xs text-[var(--text-subtle)]">{hint}</div> : <span />}
        {onClick && (
          <span className="flex items-center gap-0.5 text-[11px] text-[var(--text-subtle)] opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100">
            {actionLabel ?? 'Open'} <IconChevronRight size={11} />
          </span>
        )}
      </div>
    </Tag>
  );
}
