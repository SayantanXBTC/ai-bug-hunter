import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from './shared/PageHeader.js';
import { StatusPill, type PillTone } from './shared/StatusPill.js';
import { IconRefresh, IconSpinner, IconRadar, IconSparkles } from './icons.js';
import { entryFor } from './navigation.js';
import { ACCENT_COLOR } from './shared/MetricPanel.js';
import { OrbitalEmptyState } from './shared/OrbitalEmptyState.js';
import { formatPercent } from '../lib/format.js';

interface Reliability {
  externalTestId: string;
  testName: string;
  totalRuns: number;
  passCount: number;
  failureCount: number;
  flakyScore: number;
  reliabilityScore: number;
  status: 'stable' | 'suspected_flaky' | 'flaky' | 'unstable' | 'insufficient_data';
  signals: Array<{ name: string; contribution: number; explanation: string }>;
  explanation: string;
  calculatedAt: string;
  recentRuns?: Array<{ status: string; at: string }>;
}

const STATUS_TONE: Record<Reliability['status'], PillTone> = {
  stable: 'passed',
  suspected_flaky: 'error',
  flaky: 'failed',
  unstable: 'error',
  insufficient_data: 'neutral',
};

const STATUS_LABEL: Record<Reliability['status'], string> = {
  stable: 'Stable',
  suspected_flaky: 'Suspected Flaky',
  flaky: 'Flaky',
  unstable: 'Unstable',
  insufficient_data: 'Insufficient Data',
};

const HINTS: Record<Reliability['status'], string> = {
  stable: 'Consistent pass/fail behavior',
  suspected_flaky: 'Early flakiness signals',
  flaky: 'Non-deterministic outcomes',
  unstable: 'Consistently failing recently',
  insufficient_data: 'Not enough runs to classify',
};

const MIN_RUNS_DEFAULT = 5;

const STATUS_COLOR: Record<Reliability['status'], string> = {
  stable: ACCENT_COLOR.emerald,
  suspected_flaky: ACCENT_COLOR.orange,
  flaky: ACCENT_COLOR.red,
  unstable: '#f97316',
  insufficient_data: ACCENT_COLOR.neutral,
};

const ORDER: Reliability['status'][] = ['stable', 'suspected_flaky', 'flaky', 'unstable', 'insufficient_data'];

function Donut({ counts, total }: { counts: Record<Reliability['status'], number>; total: number }): JSX.Element {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const stableShare = total > 0 ? counts.stable / total : 0;
  return (
    <div className="relative h-[140px] w-[140px] shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-hover)" strokeWidth="14" />
        {total > 0 &&
          ORDER.map((st) => {
            const len = (counts[st] / total) * c;
            if (len === 0) return null;
            const el = (
              <circle
                key={st}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={STATUS_COLOR[st]}
                strokeWidth="14"
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                strokeDashoffset={-offset}
                className="abh-fade-in"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-semibold tabular-nums text-[var(--text)]">{total > 0 ? `${Math.round(stableShare * 100)}%` : '—'}</div>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-subtle)]">stable</div>
      </div>
    </div>
  );
}

interface TestReliabilityProps {
  onNavigateToTests?: () => void;
}

export function TestReliability({ onNavigateToTests }: TestReliabilityProps = {}): JSX.Element {
  const [items, setItems] = useState<Reliability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<Reliability['status'] | null>(null);

  const load = async (): Promise<void> => {
    try {
      const res = await fetch('/api/ai/test-reliability?page=1&limit=100');
      const body = await res.json();
      setItems(body.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const recalc = async (): Promise<void> => {
    setRecalculating(true);
    setError(null);
    try {
      await fetch('/api/ai/test-reliability/recalculate', { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setRecalculating(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<Reliability['status'], number> = {
      stable: 0,
      suspected_flaky: 0,
      flaky: 0,
      unstable: 0,
      insufficient_data: 0,
    };
    for (const r of items ?? []) c[r.status]++;
    return c;
  }, [items]);

  const matrixRows = useMemo(() => {
    const withRuns = (items ?? []).filter((r) => (r.recentRuns?.length ?? 0) > 0);
    return showAll ? withRuns : withRuns.slice(0, 20);
  }, [items, showAll]);

  const maxCols = useMemo(() => {
    const maxLen = matrixRows.reduce((m, r) => Math.max(m, r.recentRuns?.length ?? 0), 0);
    return Math.min(maxLen, 10);
  }, [matrixRows]);

  const loading = items === null && !error;

  const total = items?.length ?? 0;
  const listed = (items ?? []).filter((r) => !filter || r.status === filter);
  const toggle = (st: Reliability['status']): void => setFilter((cur) => (cur === st ? null : st));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="STABILITY MATRIX"
        title="Test Reliability"
        subtitle="Historical stability and flakiness analysis across your test suite."
        icon={<IconRadar size={22} />}
        guide={entryFor('reliability').guide}
        actions={
          <button type="button" onClick={recalc} disabled={recalculating} className="abh-btn abh-btn-primary">
            {recalculating ? <IconSpinner size={14} /> : <IconRefresh size={14} />}
            {recalculating ? 'Recalculating…' : 'Recalculate'}
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {total > 0 && (
        <div className="abh-card flex flex-wrap items-center gap-6 p-5">
          <Donut counts={counts} total={total} />
          <div className="min-w-[220px] flex-1 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-subtle)]">
              Suite distribution · {total} test{total === 1 ? '' : 's'}
            </div>
            {ORDER.map((st, i) => (
              <button
                key={st}
                type="button"
                onClick={() => toggle(st)}
                title={HINTS[st]}
                aria-pressed={filter === st}
                className={`group flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-[var(--surface-hover)] ${filter === st ? 'bg-[var(--surface-hover)]' : ''}`}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR[st] }} />
                <span className="w-32 text-xs text-[var(--text-muted)] group-hover:text-[var(--text)]">{STATUS_LABEL[st]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <div
                    className="abh-grow-x h-full rounded-full"
                    style={{ width: `${(counts[st] / total) * 100}%`, background: STATUS_COLOR[st], animationDelay: `${i * 80}ms` }}
                  />
                </div>
                <span className="w-6 text-right text-xs tabular-nums text-[var(--text-muted)]">{counts[st]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="abh-skeleton h-40 rounded-2xl" />
      ) : matrixRows.length > 0 && maxCols > 0 ? (
        <div className="abh-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                STABILITY MATRIX
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Each square is one run. Alternating colours on a row usually means flakiness.</p>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-subtle)] tabular-nums">
              {matrixRows.length} TEST{matrixRows.length === 1 ? '' : 'S'} · LAST {maxCols} RUN
              {maxCols === 1 ? '' : 'S'}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th scope="col" className="w-56 py-1 text-left font-normal text-[10px] uppercase tracking-widest text-[var(--text-subtle)]">
                    Test
                  </th>
                  {Array.from({ length: maxCols }).map((_, i) => (
                    <th key={i} scope="col" className="px-1 py-1 text-center font-normal text-[10px] tabular-nums text-[var(--text-subtle)]">
                      {String(i + 1).padStart(2, '0')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((r, row) => {
                  const runs = (r.recentRuns ?? []).slice(0, maxCols);
                  return (
                    <tr key={r.externalTestId} className="group border-t border-[var(--border)] hover:bg-[var(--surface-hover)]">
                      <td className="max-w-[220px] truncate py-2 pr-2 text-[var(--text-muted)] group-hover:text-[var(--text)]" title={r.testName}>
                        {r.testName}
                      </td>
                      {Array.from({ length: maxCols }).map((_, i) => {
                        const run = runs[i];
                        const cls = !run
                          ? 'bg-[var(--surface-hover)]'
                          : run.status === 'passed'
                            ? 'bg-emerald-500/80 shadow-[0_0_8px_-2px_rgba(16,185,129,0.8)]'
                            : run.status === 'failed' || run.status === 'error'
                              ? 'bg-red-500/80 shadow-[0_0_8px_-2px_rgba(239,68,68,0.8)]'
                              : 'bg-[var(--text-subtle)]';
                        return (
                          <td key={i} className="px-1 py-1.5">
                            <div
                              className={`mx-auto h-3.5 w-3.5 rounded-[4px] transition-transform duration-200 hover:scale-150 ${cls}`}
                              style={{ animation: 'abhScaleIn 0.4s var(--ease-out) backwards', animationDelay: `${row * 30 + i * 25}ms` }}
                              title={run ? `${run.status} · ${new Date(run.at).toLocaleString()}` : 'no data'}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-widest text-[var(--text-subtle)]">
            <LegendSwatch cls="bg-emerald-500/70" label="Passed" />
            <LegendSwatch cls="bg-red-500/70" label="Failed" />
            <LegendSwatch cls="bg-[var(--text-subtle)]" label="Skipped" />
            <LegendSwatch cls="bg-[var(--surface-hover)]" label="No Data" />
          </div>
        </div>
      ) : null}

      {items && items.length === 0 && !loading && (
        <OrbitalEmptyState
          visualization="ring"
          accent="violet"
          title="Insufficient data"
          subtitle="Run tests repeatedly to establish reliability patterns."
          steps={[
            'Run each test several times from the Tests page.',
            'Come back and press Recalculate.',
            'Flaky and unstable tests get flagged with the reason why.',
          ]}
          {...(onNavigateToTests
            ? { cta: { label: 'Go to Tests', onClick: onNavigateToTests, icon: <IconSparkles size={14} /> } }
            : {})}
        />
      )}

      {listed.length > 0 && (
        <div className="abh-stagger space-y-2">
          {listed.map((r) => (
            <ReliabilityCard key={r.externalTestId} r={r} />
          ))}
        </div>
      )}

      {items && items.length > 0 && listed.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          No tests in this state.{' '}
          <button type="button" className="text-[var(--primary-strong)] hover:underline" onClick={() => setFilter(null)}>
            Show all
          </button>
        </div>
      )}

      {items && items.length > 20 && matrixRows.length < items.length && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="abh-btn abh-btn-ghost mx-auto flex">
          {showAll ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

function LegendSwatch({ cls, label }: { cls: string; label: string }): JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${cls}`} /> {label}
    </span>
  );
}

function ReliabilityCard({ r }: { r: Reliability }): JSX.Element {
  const insufficient = r.status === 'insufficient_data';
  const color = STATUS_COLOR[r.status];
  return (
    <div
      className={`abh-card abh-lift relative overflow-hidden p-4 pl-5 ${insufficient ? 'opacity-75' : ''}`}
    >
      <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: color }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[var(--text)]">{r.testName}</div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-subtle)]">
            {r.externalTestId}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusPill>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Stat label="Passed" value={`${r.passCount} / ${r.totalRuns}`} />
        <Stat label="Failed" value={String(r.failureCount)} />
        <div>
          <Stat label="Reliability" value={formatPercent(r.reliabilityScore, 0)} />
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div className="abh-grow-x h-full rounded-full bg-[var(--success)]" style={{ width: `${Math.round(r.reliabilityScore * 100)}%` }} />
          </div>
        </div>
        <div>
          <Stat label="Flaky Score" value={formatPercent(r.flakyScore, 0)} />
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div className="abh-grow-x h-full rounded-full bg-[var(--warning)]" style={{ width: `${Math.round(r.flakyScore * 100)}%` }} />
          </div>
        </div>
      </div>
      {insufficient ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3 text-xs text-[var(--text-muted)]">
          <span className="font-medium uppercase tracking-widest text-[var(--text-subtle)]">
            INSUFFICIENT DATA
          </span>{' '}
          — Only {r.totalRuns} run{r.totalRuns === 1 ? '' : 's'} recorded. Minimum{' '}
          {MIN_RUNS_DEFAULT} required for reliability classification.
        </div>
      ) : (
        <>
          {r.explanation && (
            <div className="mt-3 text-xs text-[var(--text-muted)]">{r.explanation}</div>
          )}
          {r.signals.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-[var(--text-subtle)]">
              {r.signals.slice(0, 4).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[var(--primary-strong)]">›</span>
                  <span>
                    <span className="text-[var(--text-muted)]">{s.name}</span>{' '}
                    <span className="tabular-nums text-[var(--text-subtle)]">
                      ({s.contribution >= 0 ? '+' : ''}
                      {s.contribution.toFixed(2)})
                    </span>{' '}
                    — {s.explanation}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-subtle)]">
        {label}
      </div>
      <div className="mt-0.5 tabular-nums text-[var(--text)]">{value}</div>
    </div>
  );
}
