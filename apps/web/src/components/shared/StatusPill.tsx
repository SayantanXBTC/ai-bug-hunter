import type { ReactNode } from 'react';

export type PillTone = 'passed' | 'failed' | 'error' | 'running' | 'skipped' | 'ai' | 'neutral';

const TONE: Record<PillTone, string> = {
  passed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-300 border-red-500/20',
  error: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  running: 'bg-violet-500/10 text-violet-300 border-violet-500/20 sp-pulse',
  skipped: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  ai: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  neutral: 'bg-white/[0.04] text-neutral-300 border-white/10',
};

const DOT: Record<PillTone, string> = {
  passed: 'bg-emerald-400',
  failed: 'bg-red-400',
  error: 'bg-orange-400',
  running: 'bg-violet-400',
  skipped: 'bg-neutral-500',
  ai: 'bg-violet-400',
  neutral: 'bg-neutral-500',
};

interface Props {
  tone: PillTone;
  children: ReactNode;
  dot?: boolean;
}

export function StatusPill({ tone, children, dot = true }: Props): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${TONE[tone]}`}
    >
      {dot && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />}
      {children}
      <style>{`
        @keyframes spPulse { 0%,100% { opacity: 1;} 50% { opacity: 0.6;} }
        .sp-pulse { animation: spPulse 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sp-pulse { animation: none;} }
      `}</style>
    </span>
  );
}
