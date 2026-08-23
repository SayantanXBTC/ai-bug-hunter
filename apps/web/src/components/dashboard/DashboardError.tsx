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
      className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700 shadow-[var(--shadow)]"
    >
      <div className="flex items-start gap-3">
        <IconAlertTriangle size={20} className="mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold">Failed to load dashboard</div>
          <div className="mt-1 text-sm text-red-600">{message}</div>
          {requestId && (
            <div className="mt-2 text-xs text-red-500">Request ID: {requestId}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <IconRefresh size={14} />
          Retry
        </button>
      </div>
    </div>
  );
}
