interface QuickActionsProps {
  canWrite: boolean;
  onDiscover: () => void;
  onGenerate: () => void;
  onRun: () => void;
  onRegression: () => void;
}

export function QuickActions({
  canWrite,
  onDiscover,
  onGenerate,
  onRun,
  onRegression,
}: QuickActionsProps): JSX.Element {
  const actions: Array<{ label: string; onClick: () => void }> = [
    { label: 'Discover Application', onClick: onDiscover },
    { label: 'Generate Tests', onClick: onGenerate },
    { label: 'Run Test', onClick: onRun },
    { label: 'Create Regression Campaign', onClick: onRegression },
  ];

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Quick Actions</h2>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        {canWrite ? 'Jump into a common workflow.' : 'Read-only role — actions disabled.'}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={!canWrite}
            onClick={a.onClick}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:bg-[var(--surface-hover)] disabled:text-[var(--text-subtle)]"
          >
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
