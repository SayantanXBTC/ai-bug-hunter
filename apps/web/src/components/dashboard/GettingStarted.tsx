import type { ReactNode } from 'react';
import { IconArrowRight, IconCheck, IconLayers, IconList, IconSparkles, IconTarget } from '../icons.js';
import type { PageAction, ViewId } from '../navigation.js';

export interface JourneyState {
  apps: number;
  tests: number | null;
  runs: number;
  campaigns: boolean;
}

interface Props {
  state: JourneyState;
  canWrite: boolean;
  onGo: (view: ViewId, action?: PageAction) => void;
}

interface Step {
  key: string;
  title: string;
  desc: string;
  done: boolean;
  view: ViewId;
  action?: PageAction;
  cta: string;
  icon: ReactNode;
}

/**
 * Checklist that walks a new user through the core workflow. Each step is
 * derived from real data, so it ticks itself off as the user progresses.
 */
export function GettingStarted({ state, canWrite, onGo }: Props): JSX.Element | null {
  const steps: Step[] = [
    {
      key: 'app',
      title: 'Add an application',
      desc: 'Register the URL you want tested, then press Discover to map it.',
      done: state.apps > 0,
      view: 'applications',
      action: 'add-application',
      cta: 'Add application',
      icon: <IconLayers size={16} />,
    },
    {
      key: 'tests',
      title: 'Generate tests',
      desc: 'AI drafts test cases from the discovered pages and forms.',
      done: (state.tests ?? 0) > 0,
      view: 'tests',
      action: 'generate-tests',
      cta: 'Generate tests',
      icon: <IconSparkles size={16} />,
    },
    {
      key: 'run',
      title: 'Run a test',
      desc: 'Execute in real Chromium and collect screenshots and logs.',
      done: state.runs > 0,
      view: 'tests',
      cta: 'Open tests',
      icon: <IconList size={16} />,
    },
    {
      key: 'campaign',
      title: 'Run a regression campaign',
      desc: 'Batch your tests and get one healthy / degraded / failed verdict.',
      done: state.campaigns,
      view: 'regression',
      action: 'create-campaign',
      cta: 'Create campaign',
      icon: <IconTarget size={16} />,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const nextIdx = steps.findIndex((s) => !s.done);
  const pct = doneCount / steps.length;

  return (
    <section className="abh-card abh-fade-up relative overflow-hidden p-5 sm:p-6">
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--primary-strong)]">
            Getting started
          </div>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
            {doneCount === 0 ? 'Four steps to your first quality report' : `${steps.length - doneCount} step${steps.length - doneCount === 1 ? '' : 's'} left`}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Steps tick themselves off as your data arrives.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct * 100}%`, background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
            />
          </div>
          <span className="text-xs tabular-nums text-[var(--text-muted)]">
            {doneCount}/{steps.length}
          </span>
        </div>
      </div>

      <ol className="relative mt-5 grid gap-3 md:grid-cols-4">
        {steps.map((s, i) => {
          const isNext = i === nextIdx;
          return (
            <li
              key={s.key}
              className={`abh-fade-up relative flex flex-col rounded-2xl border p-4 transition-all ${
                isNext
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] shadow-[0_10px_30px_-18px_var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--surface-hover)]'
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-3 top-8 z-10 hidden h-px w-3 md:block"
                  style={{ background: s.done ? 'var(--success)' : 'var(--border)' }}
                />
              )}
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    s.done ? 'text-white' : isNext ? 'abh-pulse-ring text-white' : 'border border-[var(--border)] text-[var(--text-subtle)]'
                  }`}
                  style={
                    s.done
                      ? { background: 'var(--success)' }
                      : isNext
                        ? { background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }
                        : undefined
                  }
                >
                  {s.done ? <IconCheck size={14} /> : s.icon}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-subtle)]">
                  Step {i + 1}
                </span>
              </div>
              <div className={`mt-3 text-sm font-medium ${s.done ? 'text-[var(--text-muted)] line-through decoration-[var(--success)]' : 'text-[var(--text)]'}`}>
                {s.title}
              </div>
              <p className="mt-1 flex-1 text-xs leading-snug text-[var(--text-subtle)]">{s.desc}</p>
              {!s.done && (canWrite || !s.action) && (
                <button
                  type="button"
                  onClick={() => onGo(s.view, canWrite ? s.action : undefined)}
                  className={`abh-btn abh-btn-sm mt-3 w-full ${isNext ? 'abh-btn-primary' : 'abh-btn-ghost'}`}
                >
                  {s.cta} <IconArrowRight size={12} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
