import type { ReactNode } from 'react';
import { PageAmbient } from './PageAmbient.js';

interface PageShellProps {
  children: ReactNode;
  /**
   * Retained for API compatibility. Both branches now use theme tokens so the
   * shell responds to dark/light theme switches automatically.
   */
  themed?: boolean;
}

export function PageShell({ children }: PageShellProps): JSX.Element {
  return (
    <div className="relative -m-6 min-h-[calc(100vh-4rem)] bg-[var(--bg)] p-6 text-[var(--text)]">
      <PageAmbient />
      <div className="relative mx-auto max-w-7xl space-y-6">{children}</div>
    </div>
  );
}
