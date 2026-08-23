import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  aiAccent?: boolean;
}

export function MetricCard({ label, value, hint, aiAccent = false }: MetricCardProps): JSX.Element {
  const borderCls = aiAccent
    ? 'border-violet-200 bg-white'
    : 'border-neutral-200 bg-white';
  return (
    <div className={`rounded-lg border ${borderCls} p-5 shadow-sm`}>
      <div className="flex items-center gap-1.5">
        {aiAccent && (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500"
          />
        )}
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}
