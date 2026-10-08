import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  /** Retained for API compatibility. */
  themed?: boolean;
}

/** Page content column. The ambient backdrop is rendered once by the app shell. */
export function PageShell({ children }: PageShellProps): JSX.Element {
  return (
    <div className="relative mx-auto w-full max-w-7xl space-y-6 px-4 pb-16 pt-6 text-[var(--text)] sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
