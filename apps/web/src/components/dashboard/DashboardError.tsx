import { IconAlertTriangle, IconRefresh } from '../icons.js';

interface DashboardErrorProps {
  message: string;
  requestId?: string | null;
  onRetry: () => void;
}

export function DashboardError({ message, requestId, onRetry }: DashboardErrorProps): JSX.Element {
  return (
    <div
      role="alert"
      className="abh-card abh-fade-up p-5"
      style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'var(--danger-soft)' }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
          <IconAlertTriangle size={18} />
        </span>
        <div className="flex-1">
          <div className="font-semibold text-[var(--text)]">Something went wrong while loading</div>
          <div className="mt-1 text-sm text-[var(--text-muted)]">{message}</div>
          {requestId && (
            <div className="mt-2 font-mono text-[11px] text-[var(--text-subtle)]">Request ID: {requestId}</div>
          )}
        </div>
        <button type="button" onClick={onRetry} className="abh-btn abh-btn-ghost">
          <IconRefresh size={14} />
          Retry
        </button>
      </div>
    </div>
  );
}
