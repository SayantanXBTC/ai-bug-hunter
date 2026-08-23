import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from './shared/PageHeader.js';
import { MetricPanel } from './shared/MetricPanel.js';
import { StatusPill, type PillTone } from './shared/StatusPill.js';
import { IconRefresh, IconSpinner } from './icons.js';
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

export function TestReliability(): JSX.Element {
  const [items, setItems] = useState<Reliability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [showAll, setShowAll] = useState(false);

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="STABILITY MATRIX"
        title="Test Reliability"
        subtitle="Historical stability and flakiness analysis across your test suite."
        actions={
          <button
            type="button"
            onClick={recalc}
            disabled={recalculating}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:border-violet-500/40 hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
          >
            {recalculating ? <IconSpinner size={14} /> : <IconRefresh size={14} />}
            {recalculating ? 'Recalculating…' : 'Recalculate'}
          </button>
        }
      />

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricPanel index={0} label="Stable" value={counts.stable} hint={HINTS.stable} accent="emerald" />
        <MetricPanel index={1} label="Suspected Flaky" value={counts.suspected_flaky} hint={HINTS.suspected_flaky} accent="orange" />
        <MetricPanel index={2} label="Flaky" value={counts.flaky} hint={HINTS.flaky} accent="red" />
        <MetricPanel index={3} label="Unstable" value={counts.unstable} hint={HINTS.unstable} accent="orange" />
        <MetricPanel index={4} label="Insufficient" value={counts.insufficient_data} hint={HINTS.insufficient_data} accent="neutral" />
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
      ) : matrixRows.length > 0 && maxCols > 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] p-5 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-subtle)]">
              STABILITY MATRIX
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
                {matrixRows.map((r) => {
                  const runs = (r.recentRuns ?? []).slice(0, maxCols);
                  return (
                    <tr key={r.externalTestId} className="border-t border-[var(--border)]">
                      <td className="max-w-[220px] truncate py-1.5 pr-2 text-[var(--text-muted)]" title={r.testName}>
                        {r.testName}
                      </td>
                      {Array.from({ length: maxCols }).map((_, i) => {
                        const run = runs[i];
                        const cls = !run
                          ? 'bg-[var(--surface-hover)]'
                          : run.status === 'passed'
                            ? 'bg-emerald-500/70'
                            : run.status === 'failed' || run.status === 'error'
                              ? 'bg-red-500/70'
                              : 'bg-[var(--text-subtle)]';
                        return (
                          <td key={i} className="px-1 py-1">
                            <div
                              className={`mx-auto h-3 w-3 rounded-sm ${cls}`}
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
        />
      )}

      {items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((r) => (
            <ReliabilityCard key={r.externalTestId} r={r} />
          ))}
        </div>
      )}

      {items && items.length > 20 && matrixRows.length < items.length && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mx-auto block rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
        >
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
  return (
    <div
      className={`rounded-xl border p-4 backdrop-blur-md ${
        insufficient
          ? 'border-[var(--border)] bg-[var(--surface)] opacity-70'
          : 'border-[var(--border)] bg-[var(--surface-glass)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[var(--text)]">{r.testName}</div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-subtle)] truncate">
            {r.externalTestId}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusPill>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Stat label="Passed" value={`${r.passCount} / ${r.totalRuns}`} />
        <Stat label="Failed" value={String(r.failureCount)} />
        <Stat label="Reliability" value={formatPercent(r.reliabilityScore, 0)} />
        <Stat label="Flaky Score" value={formatPercent(r.flakyScore, 0)} />
      </div>
      {insufficient ? (
        <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-muted)]">
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
                  <span className="text-[var(--text-subtle)]">›</span>
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
