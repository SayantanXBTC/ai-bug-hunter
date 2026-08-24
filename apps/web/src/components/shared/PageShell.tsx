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
      {/* Top gradient rule — signature login-scene accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--primary) 40%, var(--secondary) 60%, transparent 100%)',
          opacity: 0.35,
        }}
      />
      <div className="relative mx-auto max-w-7xl space-y-6">{children}</div>
    </div>
  );
}
