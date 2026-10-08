import { useEffect, useState, type ReactNode } from 'react';
import type { PageAction, ViewId } from '../navigation.js';
import { IconArrowLeft, IconArrowRight, IconXMark } from '../icons.js';

interface Props {
  open: boolean;
  canWrite: boolean;
  onClose: () => void;
  onGo: (view: ViewId, action?: PageAction) => void;
}

interface TourStep {
  title: string;
  body: string;
  view: ViewId;
  action?: PageAction;
  cta: string;
  art: ReactNode;
}

function UrlArt(): JSX.Element {
  return (
    <div className="w-full max-w-xs space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 font-mono text-xs text-[var(--text)]">
        <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
        <span className="overflow-hidden whitespace-nowrap" style={{ animation: 'tourType 2.6s steps(22) infinite alternate', width: '22ch' }}>
          https://your-app.com
        </span>
      </div>
      <div className="ml-auto w-max rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)' }}>
        + Add application
      </div>
    </div>
  );
}

function CrawlArt(): JSX.Element {
  const nodes: Array<[number, number]> = [
    [120, 30],
    [50, 90],
    [190, 90],
    [30, 160],
    [100, 160],
    [170, 160],
    [220, 160],
  ];
  const edges: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [2, 6],
  ];
  return (
    <svg width={250} height={190} viewBox="0 0 250 190" aria-hidden>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a]![0]}
          y1={nodes[a]![1]}
          x2={nodes[b]![0]}
          y2={nodes[b]![1]}
          stroke="var(--primary)"
          strokeOpacity={0.5}
          strokeDasharray="120"
          strokeDashoffset="120"
          style={{ animation: `abhDash 0.8s ease forwards ${i * 0.25}s` }}
        />
      ))}
      {nodes.map(([x, y], i) => (
        <g key={i} style={{ animation: `abhFadeIn 0.4s ease both ${i * 0.22}s` }}>
          <circle cx={x} cy={y} r={14} fill="var(--primary)" opacity={0.15} />
          <rect x={x - 9} y={y - 7} width={18} height={14} rx={3} fill="var(--surface)" stroke={i === 0 ? 'var(--secondary)' : 'var(--primary)'} />
        </g>
      ))}
    </svg>
  );
}

function GenerateArt(): JSX.Element {
  const lines = ['navigate  /checkout', 'fill      #email', 'click     button.pay', 'expect    .receipt'];
  return (
    <div className="w-full max-w-xs rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-3 font-mono text-[11px]">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--primary-strong)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--primary)]" /> AI drafting test
      </div>
      {lines.map((l, i) => (
        <div key={l} className="flex items-center gap-2 py-0.5 text-[var(--text-muted)]" style={{ animation: `abhFadeUp 0.4s ease both ${0.3 + i * 0.35}s` }}>
          <span className="text-[var(--text-subtle)]">{String(i + 1).padStart(2, '0')}</span>
          <span>{l}</span>
          <span className="ml-auto text-[var(--success)]">✓</span>
        </div>
      ))}
    </div>
  );
}

function RunArt(): JSX.Element {
  const steps = ['passed', 'passed', 'passed', 'failed'];
  return (
    <div className="w-full max-w-xs space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-3" style={{ animation: `abhFadeUp 0.4s ease both ${i * 0.3}s` }}>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-white"
            style={{ background: s === 'passed' ? 'var(--success)' : 'var(--danger)' }}
          >
            {s === 'passed' ? '✓' : '✕'}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div
              className="abh-grow-x h-full rounded-full"
              style={{
                width: `${60 + i * 10}%`,
                animationDelay: `${i * 0.3}s`,
                background: s === 'passed' ? 'var(--success)' : 'var(--danger)',
              }}
            />
          </div>
          {s === 'failed' && <span className="rounded bg-[var(--danger-soft)] px-1.5 text-[10px] text-[var(--danger)]">screenshot</span>}
        </div>
      ))}
    </div>
  );
}

function InsightArt(): JSX.Element {
  return (
    <div className="relative h-[180px] w-[220px]">
      <svg viewBox="0 0 220 180" className="absolute inset-0" aria-hidden>
        <circle cx="110" cy="90" r="70" fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="110"
          cy="90"
          r="70"
          fill="none"
          stroke="url(#tour-ring)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="440"
          strokeDashoffset="440"
          transform="rotate(-90 110 90)"
          style={{ animation: 'tourRing 1.6s var(--ease-out) forwards' }}
        />
        <defs>
          <linearGradient id="tour-ring" x1="0" x2="1">
            <stop offset="0" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--secondary)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-semibold text-[var(--text)]">92</div>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-subtle)]">quality</div>
      </div>
    </div>
  );
}

const STEPS: TourStep[] = [
  {
    title: 'Add the app you want to test',
    body: 'Paste the public URL of any web application. That is the only setup needed: no SDK, no code changes in your app.',
    view: 'applications',
    action: 'add-application',
    cta: 'Add an application',
    art: <UrlArt />,
  },
  {
    title: 'Let the crawler map it',
    body: 'Press "Discover" on your application. A real Chromium browser visits every in-scope page and records forms, buttons and stable selectors.',
    view: 'applications',
    cta: 'Go to Applications',
    art: <CrawlArt />,
  },
  {
    title: 'Generate tests with AI',
    body: 'Claude proposes test cases from the discovered map. Each step is validated by code before it is saved, so no invented pages or selectors slip in.',
    view: 'tests',
    action: 'generate-tests',
    cta: 'Generate tests',
    art: <GenerateArt />,
  },
  {
    title: 'Run them and keep the evidence',
    body: 'Press "Run Test". Every step is recorded with screenshots, DOM, console and network logs, so a failure always comes with proof.',
    view: 'test-runs',
    cta: 'See test runs',
    art: <RunArt />,
  },
  {
    title: 'Read the insights',
    body: 'Bugs groups failures that share a root cause. Reliability flags flaky tests. Regression runs batches and returns one verdict. The dashboard rolls it all into a quality score.',
    view: 'dashboard',
    cta: 'Open dashboard',
    art: <InsightArt />,
  },
];

export function WelcomeTour({ open, canWrite, onClose, onGo }: Props): JSX.Element | null {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((v) => Math.min(STEPS.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  const showAction = canWrite || !step.action;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick start guide"
      className="abh-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="abh-card abh-scale-in abh-glow-border relative w-full max-w-3xl overflow-hidden"
        style={{ background: 'var(--surface-elevated)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guide"
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          <IconXMark size={16} />
        </button>
        <div className="grid md:grid-cols-[1fr_1.1fr]">
          <div
            className="relative flex min-h-[240px] items-center justify-center overflow-hidden p-6"
            style={{
              background:
                'radial-gradient(300px 220px at 50% 40%, var(--primary-soft), transparent 70%), var(--surface)',
            }}
          >
            <div key={i} className="abh-scale-in flex w-full justify-center">
              {step.art}
            </div>
          </div>
          <div className="flex flex-col p-6 sm:p-8">
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--primary-strong)]">
              Quick start · Step {i + 1} of {STEPS.length}
            </div>
            <h2 key={`t-${i}`} className="abh-fade-up mt-2 text-xl font-semibold text-[var(--text)]" style={{ fontFamily: 'var(--font-heading)' }}>
              {step.title}
            </h2>
            <p key={`b-${i}`} className="abh-fade-up mt-2 text-sm leading-relaxed text-[var(--text-muted)]" style={{ animationDelay: '60ms' }}>
              {step.body}
            </p>
            {showAction && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGo(step.view, canWrite ? step.action : undefined);
                }}
                className="abh-btn abh-btn-ghost mt-4 w-max"
              >
                {step.cta} <IconArrowRight size={13} />
              </button>
            )}
            <div className="mt-auto flex items-center justify-between gap-3 pt-8">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Go to step ${idx + 1}`}
                    onClick={() => setI(idx)}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: idx === i ? 22 : 8,
                      background: idx <= i ? 'linear-gradient(90deg, var(--primary), var(--secondary))' : 'var(--border)',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {i > 0 && (
                  <button type="button" onClick={() => setI(i - 1)} className="abh-btn abh-btn-ghost" aria-label="Previous step">
                    <IconArrowLeft size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (last ? onClose() : setI(i + 1))}
                  className="abh-btn abh-btn-primary"
                >
                  {last ? 'Start exploring' : 'Next'}
                  {!last && <IconArrowRight size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes tourType { from { width: 0; } to { width: 22ch; } }
        @keyframes tourRing { to { stroke-dashoffset: 35; } }
      `}</style>
    </div>
  );
}
