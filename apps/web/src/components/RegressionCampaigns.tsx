import { useEffect, useState } from 'react';
import { ThemedPageHeader } from './shared/ThemedPageHeader.js';
import { IconPlus, IconRefresh, IconChevronRight, IconTarget, IconPlay, IconXMark, IconSpinner, IconCheck } from './icons.js';
import { entryFor } from './navigation.js';

interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  trigger: string;
  selection_strategy: string;
  selected_test_count: number;
  passed_runs: number;
  failed_runs: number;
  error_runs: number;
  quality: string | null;
  application_id: string | null;
  created_at: string;
  finished_at: string | null;
}

interface CampaignDetail {
  campaign: CampaignSummary;
  members: Array<{
    testCaseId: string;
    testCaseName: string;
    priority: string;
    selectionScore: number;
    selectionReason: Array<{ name: string; contribution: number; explanation: string }>;
    executionRunId: string | null;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    ordinal: number;
  }>;
}

interface ApplicationOption {
  id: string;
  name: string;
}

const QUALITY_TONE: Record<string, string> = {
  healthy: 'text-[var(--success)] border-[var(--success)]',
  degraded: 'text-[var(--warning)] border-[var(--warning)]',
  failed: 'text-[var(--danger)] border-[var(--danger)]',
  inconclusive: 'text-[var(--text-subtle)] border-[var(--border)]',
};

type Stage = 'SELECT' | 'REVIEW' | 'EXECUTE' | 'ANALYZE';
const STAGES: Stage[] = ['SELECT', 'REVIEW', 'EXECUTE', 'ANALYZE'];

function stageFromStatus(status: string | null): Stage {
  if (!status || status === 'queued') return 'REVIEW';
  if (status === 'running') return 'EXECUTE';
  if (status === 'passed' || status === 'failed' || status === 'cancelled' || status === 'error') {
    return 'ANALYZE';
  }
  return 'SELECT';
}

const STRATEGIES: Array<{ value: string; label: string; desc: string }> = [
  { value: 'risk_based', label: 'Risk based', desc: 'Prioritises tests with failures, regressed bugs and high priority.' },
  { value: 'smoke', label: 'Smoke', desc: 'A quick sanity pass over the most important paths.' },
  { value: 'all_enabled', label: 'All enabled', desc: 'Every enabled test, up to the budget.' },
  { value: 'changed_area', label: 'Changed area', desc: 'Tests covering recently changed areas.' },
  { value: 'bug_targeted', label: 'Bug targeted', desc: 'Tests linked to known bug clusters.' },
];

const STATUS_COLOR: Record<string, string> = {
  queued: 'var(--text-muted)',
  running: 'var(--secondary)',
  passed: 'var(--success)',
  failed: 'var(--danger)',
  cancelled: 'var(--text-subtle)',
  error: 'var(--warning)',
};

interface RegressionCampaignsProps {
  openCreateOnMount?: boolean;
  onActionConsumed?: () => void;
}

export function RegressionCampaigns({
  openCreateOnMount = false,
  onActionConsumed,
}: RegressionCampaignsProps = {}): JSX.Element {
  const [items, setItems] = useState<CampaignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState('risk_based');
  const [maxTests, setMaxTests] = useState(10);
  const [applicationId, setApplicationId] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [apps, setApps] = useState<ApplicationOption[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!openCreateOnMount) return;
    setCreating(true);
    onActionConsumed?.();
  }, [openCreateOnMount, onActionConsumed]);

  const load = async (): Promise<void> => {
    try {
      const res = await fetch('/api/regression-campaigns?page=1&limit=25', {
        credentials: 'include',
      });
      const body = await res.json();
      setItems(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    }
  };

  useEffect(() => {
    void load();
  }, [refreshTick]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/applications?limit=100', { credentials: 'include' });
        if (!res.ok) return;
        const body = (await res.json()) as { items: ApplicationOption[] };
        setApps(body.items ?? []);
      } catch {
        // ignore
      }
    })().catch(() => undefined);
  }, []);

  useEffect(() => {
    setDetail(null);
    if (!selected) return;
    fetch(`/api/regression-campaigns/${selected}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((body: CampaignDetail) => setDetail(body))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'unknown'));
  }, [selected]);

  const create = async (): Promise<void> => {
    setError(null);
    try {
      const res = await fetch('/api/regression-campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          strategy,
          maxTests,
          ...(applicationId ? { applicationId } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setCreating(false);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    }
  };

  const run = async (id: string): Promise<void> => {
    setRunning(id);
    try {
      await fetch(`/api/regression-campaigns/${id}/run`, {
        method: 'POST',
        credentials: 'include',
      });
      await load();
      if (selected === id) {
        const body = await (
          await fetch(`/api/regression-campaigns/${id}`, { credentials: 'include' })
        ).json();
        setDetail(body);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setRunning(null);
    }
  };

  const cancel = async (id: string): Promise<void> => {
    await fetch(`/api/regression-campaigns/${id}/cancel`, {
      method: 'POST',
      credentials: 'include',
    });
    setRefreshTick((t) => t + 1);
  };

  const currentStage: Stage = creating
    ? 'SELECT'
    : selected && detail
      ? stageFromStatus(detail.campaign.status)
      : 'SELECT';

  return (
    <div className="space-y-6">
      <ThemedPageHeader
        eyebrow="MISSION CONTROL"
        title="Regression"
        subtitle="Design, review, execute and analyze regression campaigns."
        icon={<IconTarget size={22} />}
        guide={entryFor('regression').guide}
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRefreshTick((t) => t + 1)} className="abh-btn abh-btn-ghost">
              <IconRefresh size={14} />
              Refresh
            </button>
            <button type="button" onClick={() => setCreating((c) => !c)} className="abh-btn abh-btn-primary">
              {creating ? <IconXMark size={14} /> : <IconPlus size={14} />}
              {creating ? 'Close' : 'Create campaign'}
            </button>
          </div>
        }
      />

      <Pipeline current={currentStage} />

      {creating && (
        <section
          aria-label="Mission Configuration"
          className="abh-card abh-glow-border abh-fade-up p-5 sm:p-6"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--primary-strong)]">
            Mission Configuration
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Choose an application, a selection strategy and a test budget. The campaign is queued for
            your review; nothing executes until you press Run.
          </p>

          <div className="mt-5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-subtle)]">Strategy</div>
          <div role="radiogroup" aria-label="Strategy" className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {STRATEGIES.map((st) => {
              const on = strategy === st.value;
              return (
                <button
                  key={st.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStrategy(st.value)}
                  className={`relative rounded-xl border p-3 text-left transition-all ${
                    on
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] shadow-[0_8px_24px_-14px_var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <span
                    className={`absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                      on ? 'border-transparent text-white' : 'border-[var(--border)]'
                    }`}
                    style={on ? { background: 'var(--primary)' } : undefined}
                  >
                    {on && <IconCheck size={10} />}
                  </span>
                  <span className="block text-sm font-medium text-[var(--text)]">{st.label}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-[var(--text-subtle)]">{st.value}</span>
                  <span className="mt-1.5 block text-[11px] leading-snug text-[var(--text-muted)]">{st.desc}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Application">
              <select
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="abh-input mt-1"
              >
                <option value="">— any —</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Max tests · ${maxTests}`}>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={Math.min(100, maxTests)}
                  onChange={(e) => setMaxTests(Number(e.target.value))}
                  className="flex-1 accent-[var(--primary)]"
                  aria-label="Max tests slider"
                />
                <input
                  type="number"
                  min={1}
                  value={maxTests}
                  onChange={(e) => setMaxTests(Number(e.target.value))}
                  className="abh-input w-20"
                />
              </div>
            </Field>
            <div className="flex items-end">
              <button type="button" onClick={create} className="abh-btn abh-btn-primary w-full">
                Queue campaign
              </button>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {items === null && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="abh-skeleton h-36 rounded-2xl" />
          ))}
        </div>
      )}

      {items !== null && items.length === 0 && !creating && <EmptyCampaigns onCreate={() => setCreating(true)} />}

      {items && items.length > 0 && (
        <ul className="abh-stagger space-y-3">
          {items.map((c) => {
            const done = c.passed_runs + c.failed_runs + c.error_runs;
            const total = Math.max(1, c.selected_test_count);
            const color = STATUS_COLOR[c.status] ?? 'var(--text-muted)';
            return (
              <li key={c.id} className="abh-card relative overflow-hidden p-5">
                <span aria-hidden className="absolute inset-y-4 left-0 w-1 rounded-r-full" style={{ background: color }} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                      Regression Campaign #{c.id.slice(0, 8)}
                    </div>
                    <div className="mt-1 truncate text-base font-semibold text-[var(--text)]">
                      {c.name}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Strategy: <span className="font-mono">{c.selection_strategy}</span> ·
                      created {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={c.status} />
                    <button
                      type="button"
                      onClick={() => setSelected(c.id === selected ? null : c.id)}
                      className="abh-btn abh-btn-ghost abh-btn-sm"
                      aria-expanded={selected === c.id}
                    >
                      {selected === c.id ? 'Hide' : 'View'}
                      <IconChevronRight size={12} className={`transition-transform ${selected === c.id ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[11px] text-[var(--text-subtle)]">
                    <span>
                      {done}/{c.selected_test_count} executed
                    </span>
                    {c.status === 'running' && (
                      <span className="flex items-center gap-1 text-[var(--secondary)]">
                        <IconSpinner size={11} /> running
                      </span>
                    )}
                  </div>
                  <div className={`flex h-2 overflow-hidden rounded-full bg-[var(--surface-hover)] ${c.status === 'running' ? 'abh-skeleton' : ''}`}>
                    <div className="abh-grow-x h-full bg-[var(--success)]" style={{ width: `${(c.passed_runs / total) * 100}%` }} />
                    <div className="abh-grow-x h-full bg-[var(--danger)]" style={{ width: `${(c.failed_runs / total) * 100}%` }} />
                    <div className="abh-grow-x h-full bg-[var(--warning)]" style={{ width: `${(c.error_runs / total) * 100}%` }} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                  <Metric label="Tests" value={c.selected_test_count} />
                  <Metric label="Passed" value={c.passed_runs} tone="success" />
                  <Metric label="Failed" value={c.failed_runs} tone="danger" />
                  <Metric label="Errored" value={c.error_runs} tone="warning" />
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-subtle)]">
                      Quality
                    </div>
                    <span
                      className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        QUALITY_TONE[c.quality ?? 'inconclusive']
                      }`}
                    >
                      {c.quality ?? 'pending'}
                    </span>
                  </div>
                </div>

                {(c.status === 'queued' || c.status === 'running') && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
                    {c.status === 'queued' && (
                      <>
                        <button
                          type="button"
                          onClick={() => run(c.id)}
                          disabled={running === c.id}
                          className="abh-btn abh-btn-success abh-btn-sm"
                        >
                          {running === c.id ? <IconSpinner size={12} /> : <IconPlay size={12} />}
                          {running === c.id ? 'Running…' : 'Run campaign'}
                        </button>
                        <span className="text-[11px] text-[var(--text-subtle)]">Review the selected tests first, then run.</span>
                      </>
                    )}
                    {c.status === 'running' && (
                      <button type="button" onClick={() => cancel(c.id)} className="abh-btn abh-btn-ghost abh-btn-sm">
                        Cancel
                      </button>
                    )}
                  </div>
                )}

                {selected === c.id && !detail && (
                  <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="abh-skeleton h-10 rounded-lg" />
                    ))}
                  </div>
                )}

                {selected === c.id && detail && (
                  <div className="abh-fade-up mt-4 border-t border-[var(--border)] pt-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                      Selected tests · why each was picked
                    </div>
                    <ul className="abh-stagger mt-2 space-y-2">
                      {detail.members.map((m) => (
                        <li
                          key={m.testCaseId}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-[var(--text)]">
                              <span className="mr-1 font-mono text-[var(--text-subtle)]">#{m.ordinal + 1}</span>
                              {m.testCaseName}{' '}
                              <span className="text-[var(--text-subtle)]">({m.priority})</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <RiskRing value={m.selectionScore} />
                              <StatusPill status={m.status} />
                            </div>
                          </div>
                          {m.selectionReason.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-[11px] text-[var(--text-subtle)]">
                              {m.selectionReason.slice(0, 3).map((r, i) => (
                                <li key={i}>
                                  <span className="font-mono text-[var(--primary-strong)]">{r.name}</span>: {r.explanation}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-subtle)]">
      {label}
      {children}
    </label>
  );
}

const STAGE_HINT: Record<Stage, string> = {
  SELECT: 'Pick strategy & budget',
  REVIEW: 'Check the chosen tests',
  EXECUTE: 'Tests run in Chromium',
  ANALYZE: 'Read the quality verdict',
};

function Pipeline({ current }: { current: Stage }): JSX.Element {
  const idx = STAGES.indexOf(current);
  return (
    <div className="abh-card p-4 sm:p-5" role="group" aria-label="Campaign pipeline">
      <div className="relative grid grid-cols-4 gap-2">
        <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-4 h-0.5 rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${(idx / (STAGES.length - 1)) * 100}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
              boxShadow: '0 0 10px var(--primary)',
            }}
          />
        </div>
        {STAGES.map((s, i) => {
          const active = s === current;
          const past = i < idx;
          return (
            <div key={s} className="relative flex flex-col items-center text-center" aria-current={active ? 'step' : undefined}>
              <span
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-500 ${
                  active
                    ? 'abh-pulse-ring scale-110 border-transparent text-white'
                    : past
                      ? 'border-transparent text-white'
                      : 'border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-subtle)]'
                }`}
                style={
                  active
                    ? { background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }
                    : past
                      ? { background: 'var(--primary)' }
                      : undefined
                }
              >
                {past ? <IconCheck size={13} /> : i + 1}
              </span>
              <span
                className={`mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                  active ? 'text-[var(--primary-strong)]' : 'text-[var(--text-subtle)]'
                }`}
              >
                {s}
              </span>
              <span className="mt-0.5 hidden text-[11px] text-[var(--text-subtle)] sm:block">{STAGE_HINT[s]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }): JSX.Element {
  const map: Record<string, string> = {
    queued: 'text-[var(--text-muted)] border-[var(--border)]',
    running: 'text-[var(--secondary)] border-[var(--secondary)] animate-pulse',
    passed: 'text-[var(--success)] border-[var(--success)]',
    failed: 'text-[var(--danger)] border-[var(--danger)]',
    cancelled: 'text-[var(--text-subtle)] border-[var(--border)]',
    error: 'text-[var(--warning)] border-[var(--warning)]',
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        map[status] ?? map.queued
      }`}
    >
      {status}
    </span>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'danger' | 'warning';
}): JSX.Element {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--success)]'
      : tone === 'danger'
        ? 'text-[var(--danger)]'
        : tone === 'warning'
          ? 'text-[var(--warning)]'
          : 'text-[var(--text)]';
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-subtle)]">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function RiskRing({ value }: { value: number }): JSX.Element {
  const v = Math.max(0, Math.min(1, value));
  const r = 8;
  const c = 2 * Math.PI * r;
  const dash = v * c;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--text-muted)]"
      title={`Risk ${Math.round(v * 100)}%`}
    >
      <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r={r} fill="none" stroke="var(--border)" strokeWidth={2} />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 10 10)"
        />
      </svg>
      {Math.round(v * 100)}%
    </span>
  );
}

function EmptyCampaigns({ onCreate }: { onCreate: () => void }): JSX.Element {
  return (
    <div className="abh-card abh-fade-up relative overflow-hidden border-dashed p-10 text-center">
      <svg aria-hidden width="120" height="120" viewBox="0 0 120 120" className="mx-auto">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-strong)" strokeDasharray="3 6" className="abh-spin-slow" style={{ transformOrigin: '60px 60px' }} />
        <circle cx="60" cy="60" r="32" fill="none" stroke="var(--primary)" strokeOpacity="0.4" />
        <circle cx="60" cy="60" r="14" fill="var(--primary)" opacity="0.25" />
        <circle cx="60" cy="60" r="5" fill="var(--primary)" className="abh-pulse-ring" />
      </svg>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-subtle)]">
        No regression campaigns
      </div>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
        A regression campaign selects a batch of your test cases and executes them together.
        You&apos;ll need at least one application and one enabled test case before creating one.
      </p>
      <button type="button" onClick={onCreate} className="abh-btn abh-btn-primary mt-5">
        <IconPlus size={14} />
        Create campaign
      </button>
    </div>
  );
}
