import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: Props): JSX.Element {
  return (
    <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
          {eyebrow}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-white/90">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
