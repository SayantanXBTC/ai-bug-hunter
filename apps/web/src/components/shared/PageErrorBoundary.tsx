import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IconAlertTriangle, IconRefresh } from '../icons.js';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Keeps one broken page from blanking the whole app: the sidebar and top bar
 * stay usable and the user can retry or navigate away.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[page] render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="abh-card abh-fade-up mx-auto mt-10 max-w-lg p-6 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
          <IconAlertTriangle size={18} />
        </span>
        <h2 className="mt-3 text-base font-semibold text-[var(--text)]">This page hit a problem</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{this.state.error.message}</p>
        <button
          type="button"
          className="abh-btn abh-btn-ghost mt-4"
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset?.();
          }}
        >
          <IconRefresh size={14} /> Try again
        </button>
      </div>
    );
  }
}
