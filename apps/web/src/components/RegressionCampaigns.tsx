import { useEffect, useState } from 'react';
import { ThemedPageHeader } from './shared/ThemedPageHeader.js';
import { IconPlus, IconRefresh, IconChevronRight } from './icons.js';

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

export function RegressionCampaigns(): JSX.Element {
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
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshTick((t) => t + 1)}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <IconRefresh size={14} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreating((c) => !c)}
              className="inline-flex items-center gap-1.5 rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <IconPlus size={14} />
              {creating ? 'Close' : 'Create campaign'}
            </button>
          </div>
        }
      />

      <Pipeline current={currentStage} />

      {creating && (
        <section
          aria-label="Mission Configuration"
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
            Mission Configuration
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Choose an application, a selection strategy and a test budget. Preview will be
            queued for review before execution.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="Application">
              <select
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <option value="">— any —</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Strategy">
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <option value="all_enabled">all_enabled</option>
                <option value="risk_based">risk_based</option>
                <option value="changed_area">changed_area</option>
                <option value="bug_targeted">bug_targeted</option>
                <option value="smoke">smoke</option>
              </select>
            </Field>
            <Field label="Max tests">
              <input
                type="number"
                min={1}
                value={maxTests}
                onChange={(e) => setMaxTests(Number(e.target.value))}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                onClick={create}
                className="w-full rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                Queue campaign
              </button>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded border border-[var(--danger)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {items === null && (
        <div className="text-sm text-[var(--text-muted)]">Loading…</div>
      )}

      {items !== null && items.length === 0 && <EmptyCampaigns onCreate={() => setCreating(true)} />}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
            >
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
                    className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    {selected === c.id ? 'Hide' : 'View'}
                    <IconChevronRight size={12} />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 text-xs sm:grid-cols-5">
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

              <div className="mt-3 flex flex-wrap gap-2">
                {c.status === 'queued' && (
                  <button
                    type="button"
                    onClick={() => run(c.id)}
                    disabled={running === c.id}
                    className="rounded bg-[var(--success)] px-3 py-1 text-xs font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--success)] disabled:opacity-50"
                  >
                    {running === c.id ? 'Running…' : 'Run campaign'}
                  </button>
                )}
                {c.status === 'running' && (
                  <button
                    type="button"
                    onClick={() => cancel(c.id)}
                    className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {selected === c.id && detail && (
                <div className="mt-4 border-t border-[var(--border)] pt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                    Selected tests
                  </div>
                  <ul className="mt-2 space-y-2">
                    {detail.members.map((m) => (
                      <li
                        key={m.testCaseId}
                        className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] p-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[var(--text)]">
                            #{m.ordinal + 1} {m.testCaseName}{' '}
                            <span className="text-[var(--text-subtle)]">({m.priority})</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <RiskRing value={m.selectionScore} />
                            <span className="text-[var(--text-muted)]">{m.status}</span>
                          </div>
                        </div>
                        {m.selectionReason.length > 0 && (
                          <ul className="mt-1 text-[11px] text-[var(--text-subtle)]">
                            {m.selectionReason.slice(0, 3).map((r, i) => (
                              <li key={i}>
                                <span className="font-mono">{r.name}</span>: {r.explanation}
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
          ))}
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

function Pipeline({ current }: { current: Stage }): JSX.Element {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
      role="group"
      aria-label="Campaign pipeline"
    >
      {STAGES.map((s, i) => {
        const active = s === current;
        return (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span
              className={`inline-flex flex-1 items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                active
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--text-subtle)]'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              {s}
            </span>
            {i < STAGES.length - 1 && (
              <span
                aria-hidden
                className="h-px flex-1 bg-[var(--border)]"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: string }): JSX.Element {
  const map: Record<string, string> = {
    queued: 'text-[var(--text-muted)] border-[var(--border)]',
    running: 'text-[var(--secondary)] border-[var(--secondary)]',
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
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-10 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-subtle)]">
        No regression campaigns
      </div>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
        A regression campaign selects a batch of your test cases and executes them together.
        You&apos;ll need at least one application and one enabled test case before creating one.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 inline-flex items-center gap-1.5 rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      >
        <IconPlus size={14} />
        Create campaign
      </button>
    </div>
  );
}
