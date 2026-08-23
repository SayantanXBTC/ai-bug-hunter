import type { ReactNode } from 'react';
import { PageAmbient } from './PageAmbient.js';

interface PageShellProps {
  children: ReactNode;
  /**
   * When true, uses CSS-variable theme tokens (respects global dark/light).
   * When false (default), uses the cinematic dark palette used by the
   * pre-existing Test Runs / Bugs / Reliability pages.
   */
  themed?: boolean;
}

export function PageShell({ children, themed = false }: PageShellProps): JSX.Element {
  if (themed) {
    return (
      <div className="relative -m-6 min-h-[calc(100vh-4rem)] bg-[var(--bg)] p-6 text-[var(--text)]">
        <PageAmbient />
        <div className="relative mx-auto max-w-7xl space-y-6">{children}</div>
      </div>
    );
  }
  return (
    <div className="relative -m-6 min-h-[calc(100vh-4rem)] bg-[#05060B] p-6 text-white/90">
      <PageAmbient />
      <div className="relative mx-auto max-w-7xl space-y-6">{children}</div>
    </div>
  );
}
