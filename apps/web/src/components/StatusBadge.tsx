import type { HealthState } from '../hooks/useHealth.js';

interface StatusBadgeProps {
  health: HealthState;
}

const STATUS_CFG: Record<HealthState['status'], { dot: string; label: string }> = {
  loading: { dot: 'bg-slate-400', label: 'Checking system status…' },
  ok: { dot: 'bg-emerald-500', label: 'System online' },
  degraded: { dot: 'bg-amber-500', label: 'System degraded' },
  error: { dot: 'bg-rose-500', label: 'API unreachable' },
};

export function StatusBadge({ health }: StatusBadgeProps): JSX.Element {
  const cfg = STATUS_CFG[health.status];

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300"
    >
      <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
      <span>{cfg.label}</span>
    </div>
  );
}
