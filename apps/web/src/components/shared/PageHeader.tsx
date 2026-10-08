import { useState, type ReactNode } from 'react';
import { IconHelp, IconXMark } from '../icons.js';
import { useStoredFlag } from '../../lib/motion.js';

export interface PageGuide {
  summary: string;
  steps: string[];
  tip?: string;
}

interface Props {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Optional icon shown in a glowing tile next to the title. */
  icon?: ReactNode;
  /** Optional "how this page works" panel. Open on first visit, then remembered. */
  guide?: PageGuide;
  /** Storage key for the guide's open state. Defaults to the title. */
  guideKey?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  icon,
  guide,
  guideKey,
}: Props): JSX.Element {
  const [guideOpen, setGuideOpen] = useStoredFlag(`abh-guide-${guideKey ?? title}`, true);

  return (
    <div className="space-y-4">
      <header className="abh-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {icon && (
            <div className="relative hidden shrink-0 sm:block">
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl blur-xl"
                style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)', opacity: 0.35 }}
              />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--primary-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                {icon}
              </div>
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--text-subtle)]">
              <span aria-hidden className="h-px w-5 bg-gradient-to-r from-transparent to-[var(--primary)]" />
              {eyebrow}
            </div>
            <h1
              className="abh-gradient-text mt-1.5 text-[28px] leading-tight tracking-tight"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{subtitle}</p>
            )}
          </div>
        </div>
        {(actions || guide) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {guide && !guideOpen && (
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="abh-btn abh-btn-ghost"
                title="Show how this page works"
              >
                <IconHelp size={14} />
                How it works
              </button>
            )}
            {actions}
          </div>
        )}
      </header>
      {guide && guideOpen && <GuidePanel guide={guide} onClose={() => setGuideOpen(false)} />}
      <div
        aria-hidden
        className="h-px w-full"
        style={{
          background:
            'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 18%, var(--border) 40%, transparent 100%)',
          opacity: 0.6,
        }}
      />
    </div>
  );
}

function GuidePanel({ guide, onClose }: { guide: PageGuide; onClose: () => void }): JSX.Element {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <section
      aria-label="How this page works"
      className="abh-card abh-fade-up abh-glow-border overflow-hidden p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--primary-strong)]">
            <IconHelp size={12} /> How this page works
          </div>
          <p className="mt-1.5 text-sm text-[var(--text)]">{guide.summary}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide guide"
          className="rounded-lg p-1.5 text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          <IconXMark size={14} />
        </button>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {guide.steps.map((s, i) => (
          <li
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="relative flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3 transition-colors"
            style={hovered === i ? { borderColor: 'var(--border-strong)' } : undefined}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
            >
              {i + 1}
            </span>
            <span className="text-[13px] leading-snug text-[var(--text-muted)]">{s}</span>
          </li>
        ))}
      </ol>
      {guide.tip && (
        <p className="mt-3 text-xs text-[var(--text-subtle)]">
          <span className="font-semibold text-[var(--secondary)]">Tip · </span>
          {guide.tip}
        </p>
      )}
    </section>
  );
}
