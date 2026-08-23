import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'violet' | 'emerald' | 'red' | 'orange' | 'neutral' | 'cyan';
  index?: number;
}

const DOT: Record<NonNullable<Props['accent']>, string> = {
  violet: 'bg-violet-400',
  emerald: 'bg-emerald-400',
  red: 'bg-red-400',
  orange: 'bg-orange-400',
  neutral: 'bg-neutral-500',
  cyan: 'bg-cyan-400',
};

export function MetricPanel({ label, value, hint, accent = 'neutral', index = 0 }: Props): JSX.Element {
  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-[rgba(12,14,22,0.65)] p-4 backdrop-blur-md transition-colors hover:border-white/[0.10]"
      style={{
        animation: 'mpIn 200ms ease-out both',
        animationDelay: `${Math.min(index, 8) * 40}ms`,
      }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[accent]}`} />
        <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
          {label}
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-white/90">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
      <style>{`
        @keyframes mpIn { from { opacity: 0; transform: translateY(4px);} to { opacity: 1; transform: translateY(0);} }
        @media (prefers-reduced-motion: reduce) { [style*="mpIn"] { animation: none !important; } }
      `}</style>
    </div>
  );
}
