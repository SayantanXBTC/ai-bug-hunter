import type { ReactNode } from 'react';
import { IconLayers, IconList, IconSparkles, IconTarget } from '../icons.js';
import { useSpotlight } from '../../lib/motion.js';

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
  const spot = useSpotlight();
  const actions: Array<{ label: string; desc: string; icon: ReactNode; color: string; onClick: () => void }> = [
    { label: 'Discover Application', desc: 'Add a URL and map its pages', icon: <IconLayers size={18} />, color: '#8b5cf6', onClick: onDiscover },
    { label: 'Generate Tests', desc: 'Let AI draft a test suite', icon: <IconSparkles size={18} />, color: '#a855f7', onClick: onGenerate },
    { label: 'Run Test', desc: 'Execute and capture evidence', icon: <IconList size={18} />, color: '#22d3ee', onClick: onRun },
    { label: 'Create Regression Campaign', desc: 'Batch-run for one verdict', icon: <IconTarget size={18} />, color: '#10b981', onClick: onRegression },
  ];

  return (
    <section className="abh-card p-5 sm:p-6">
      <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">Quick Actions</h2>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        {canWrite ? 'Jump straight into a common workflow.' : 'Read-only role — actions disabled.'}
      </p>
      <div className="abh-stagger mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={!canWrite}
            onClick={a.onClick}
            onMouseMove={spot}
            className="abh-spot abh-lift group relative flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
              style={{ background: `${a.color}22`, color: a.color }}
            >
              {a.icon}
            </span>
            <span className="relative min-w-0">
              <span className="block text-sm font-medium text-[var(--text)]">{a.label}</span>
              <span className="mt-0.5 block text-xs text-[var(--text-subtle)]">{a.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
