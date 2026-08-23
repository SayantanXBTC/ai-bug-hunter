import { useCallback, useEffect, useState } from 'react';
import type { UserRole } from '@ai-bug-hunter/shared';
import {
  IconArrowLeft,
  IconPencil,
  IconTrash,
  IconSparkles,
  IconAlertTriangle,
  IconGlobe,
  IconChevronRight,
  IconRefresh,
} from '../icons.js';
import { SkeletonCard } from '../dashboard/Skeleton.js';
import { formatDuration, formatRelativeTime, formatPercent } from '../../lib/format.js';
import { maskFieldValue } from '../../lib/sanitize.js';
import { RunTestButton } from './RunTestButton.js';
import type {
  ApplicationOption,
  ReliabilityRecord,
  TestActionRecord,
  TestCaseRow,
  TestRunSummary,
} from './types.js';
import { sourceOfTestCase } from './types.js';

interface TestDetailViewProps {
  testCaseId: string;
  role: UserRole;
  applications: ApplicationOption[];
  onBack: () => void;
  onDeleted: () => void;
  onNavigateToRun?: (runId: string) => void;
}

interface DetailState {
  loading: boolean;
  error: string | null;
  testCase: TestCaseRow | null;
}

export function TestDetailView({
  testCaseId,
  role,
  applications,
  onBack,
  onDeleted,
  onNavigateToRun,
}: TestDetailViewProps): JSX.Element {
  const canWrite = role === 'admin' || role === 'qa_engineer';
  const [state, setState] = useState<DetailState>({ loading: true, error: null, testCase: null });
  const [runs, setRuns] = useState<TestRunSummary[] | null>(null);
  const [reliability, setReliability] = useState<ReliabilityRecord | null | 'none'>(null);
  const [tick, setTick] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ loading: true, error: null, testCase: null });
    try {
      const res = await fetch(`/api/test-cases/${encodeURIComponent(testCaseId)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setState({
          loading: false,
          error: `Failed to load test case (HTTP ${res.status})`,
          testCase: null,
        });
        return;
      }
      const body = (await res.json()) as TestCaseRow;
      setState({ loading: false, error: null, testCase: body });
    } catch (e) {
      setState({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load',
        testCase: null,
      });
    }
  }, [testCaseId]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  // Fetch recent runs and reliability once the test case is loaded.
  useEffect(() => {
    const tc = state.testCase;
    if (!tc) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/test-runs?testCaseId=${encodeURIComponent(tc.id)}&limit=5`, {
          credentials: 'include',
        });
        if (!res.ok) {
          if (!cancelled) setRuns([]);
          return;
        }
        const body = (await res.json()) as { items: TestRunSummary[] };
        // Backend list route does not filter by testCaseId; do client filter as fallback.
        const filtered = (body.items ?? []).filter(
          (r) => r.testId === tc.external_test_id || r.testId === tc.definition.id,
        );
        if (!cancelled) setRuns(filtered.slice(0, 5));
      } catch {
        if (!cancelled) setRuns([]);
      }
    })().catch(() => undefined);

    (async () => {
      const externalId = tc.external_test_id ?? tc.definition.id;
      if (!externalId) {
        if (!cancelled) setReliability('none');
        return;
      }
      try {
        const res = await fetch(
          `/api/ai/test-reliability/${encodeURIComponent(externalId)}`,
          { credentials: 'include' },
        );
        if (res.status === 404) {
          if (!cancelled) setReliability('none');
          return;
        }
        if (!res.ok) {
          if (!cancelled) setReliability('none');
          return;
        }
        const body = (await res.json()) as ReliabilityRecord;
        if (!cancelled) setReliability(body);
      } catch {
        if (!cancelled) setReliability('none');
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [state.testCase]);

  const del = async (): Promise<void> => {
    if (!state.testCase) return;
    if (!window.confirm(`Delete test "${state.testCase.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/test-cases/${encodeURIComponent(state.testCase.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok && res.status !== 204) {
        setDeleteError(`Delete failed (HTTP ${res.status})`);
        setDeleting(false);
        return;
      }
      onDeleted();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
    }
  };

  if (state.loading) {
    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} />
        <SkeletonCard />
      </div>
    );
  }

  if (state.error || !state.testCase) {
    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} />
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error ?? 'Test case not found.'}
        </div>
      </div>
    );
  }

  const tc = state.testCase;
  const app = applications.find((a) => a.id === tc.application_id);
  const isAi = sourceOfTestCase(tc) === 'ai';

  return (
    <div className="space-y-5">
      <BackBar onBack={onBack} />

      <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--text)]">
                {tc.name}
              </h1>
              <SourcePill isAi={isAi} />
              <StatusPill enabled={tc.enabled} />
              <PriorityPill priority={tc.priority} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <IconGlobe size={12} />
                <span className="font-mono">{tc.target_url}</span>
              </span>
              {app && (
                <span>
                  in <span className="font-medium text-[var(--text)]">{app.name}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <RunTestButton
                testCase={tc}
                size="md"
                {...(onNavigateToRun ? { onNavigateToRun } : {})}
              />
            )}
            {canWrite && (
              <button
                type="button"
                onClick={() => window.alert('Editing tests will be available in a future release.')}
                className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <IconPencil size={12} />
                Edit
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={() => void del()}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-60"
              >
                <IconTrash size={12} />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
        {deleteError && (
          <div
            role="alert"
            className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700"
          >
            {deleteError}
          </div>
        )}
      </header>

      {tc.description && (
        <Section title="Objective">
          <p className="text-sm text-[var(--text)]">{tc.description}</p>
        </Section>
      )}

      <Section title="Steps">
        <ol className="divide-y divide-[var(--border)]">
          {tc.definition.steps.map((s, i) => (
            <StepRow key={i} step={s} index={i + 1} />
          ))}
        </ol>
      </Section>

      <Section
        title="Recent Execution"
        action={
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
          >
            <IconRefresh size={12} /> Refresh
          </button>
        }
      >
        {runs === null ? (
          <div className="py-4 text-xs text-[var(--text-muted)]">Loading runs…</div>
        ) : runs.length === 0 ? (
          <div className="py-4 text-sm text-[var(--text-muted)]">
            No runs yet. Run this test to see results.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Duration</th>
                <th className="py-2 pr-3">Started</th>
                <th className="py-2 pr-3">Run ID</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {runs.map((r) => (
                <tr
                  key={r.id}
                  className={onNavigateToRun ? 'cursor-pointer hover:bg-[var(--surface-hover)]' : ''}
                  onClick={() => onNavigateToRun?.(r.id)}
                >
                  <td className="py-2 pr-3">
                    <RunStatusPill status={r.status} />
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-[var(--text)]">
                    {formatDuration(r.durationMs)}
                  </td>
                  <td className="py-2 pr-3 text-[var(--text-muted)]">
                    {formatRelativeTime(r.startedAt ?? r.createdAt)}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-[var(--text-muted)]">
                    {r.id.slice(0, 8)}
                  </td>
                  <td className="py-2 pr-3 text-right text-[var(--text-subtle)]">
                    {onNavigateToRun && <IconChevronRight size={12} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Reliability">
        {reliability === null ? (
          <div className="py-4 text-xs text-[var(--text-muted)]">Loading…</div>
        ) : reliability === 'none' ? (
          <div className="py-3 text-sm text-[var(--text-muted)]">
            No reliability signal yet. Run this test a few times to build history.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Status" value={<ReliabilityPill status={reliability.status} />} />
            <MiniStat
              label="Pass rate"
              value={
                <span className="tabular-nums">
                  {formatPercent(reliability.passRate)}
                </span>
              }
            />
            <MiniStat
              label="Runs"
              value={<span className="tabular-nums">{reliability.totalRuns}</span>}
            />
            <MiniStat
              label="Flaky score"
              value={<span className="tabular-nums">{reliability.flakyScore.toFixed(2)}</span>}
            />
            {reliability.status === 'insufficient_data' && reliability.minRuns !== undefined && (
              <div className="col-span-full text-xs text-[var(--text-muted)]">
                Not enough runs (need {reliability.minRuns}).
              </div>
            )}
          </div>
        )}
      </Section>

      <div className="text-xs text-[var(--text-subtle)]">
        {isAi ? 'AI-generated' : 'Manual'} · Deterministic schema + business rules validated
      </div>
    </div>
  );
}

function BackBar({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
    >
      <IconArrowLeft size={12} />
      Back to Tests
    </button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: JSX.Element;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-[var(--text)]">{value}</div>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  navigate: 'Navigate',
  click: 'Click',
  fill: 'Fill',
  selectOption: 'Select option',
  press: 'Press',
  waitForSelector: 'Wait for element',
  wait: 'Wait',
};

function StepRow({ step, index }: { step: TestActionRecord; index: number }): JSX.Element {
  const label = ACTION_LABEL[step.action] ?? step.action;
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[10px] font-medium tabular-nums text-[var(--text-muted)]">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--text)]">{label}</div>
        <div className="mt-0.5 space-y-0.5 text-xs text-[var(--text-muted)]">
          {step.action === 'navigate' && typeof step.url === 'string' && (
            <div>
              URL: <span className="font-mono text-[var(--text)]">{step.url}</span>
            </div>
          )}
          {typeof step.selector === 'string' && (
            <div>
              Target: <span className="font-mono text-[var(--text)]">{step.selector}</span>
            </div>
          )}
          {step.action === 'fill' && typeof step.value === 'string' && (
            <div>
              Value:{' '}
              <span className="font-mono text-[var(--text)]">
                {maskFieldValue(typeof step.selector === 'string' ? step.selector : '', step.value)}
              </span>
            </div>
          )}
          {step.action === 'selectOption' && typeof step.value === 'string' && (
            <div>
              Option: <span className="font-mono text-[var(--text)]">{step.value}</span>
            </div>
          )}
          {step.action === 'press' && typeof step.key === 'string' && (
            <div>
              Key: <span className="font-mono text-[var(--text)]">{step.key}</span>
            </div>
          )}
          {step.action === 'wait' && typeof step.durationMs === 'number' && (
            <div>
              Duration: <span className="tabular-nums text-[var(--text)]">{step.durationMs}ms</span>
            </div>
          )}
          {step.action === 'waitForSelector' && typeof step.timeoutMs === 'number' && (
            <div>
              Timeout: <span className="tabular-nums text-[var(--text)]">{step.timeoutMs}ms</span>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function SourcePill({ isAi }: { isAi: boolean }): JSX.Element {
  if (isAi) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
        <IconSparkles size={10} />
        AI Generated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
      Manual
    </span>
  );
}

function StatusPill({ enabled }: { enabled: boolean }): JSX.Element {
  return enabled ? (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
      Enabled
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
      Disabled
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }): JSX.Element {
  const map: Record<string, string> = {
    critical: 'border-red-200 bg-red-50 text-red-700',
    high: 'border-amber-200 bg-amber-50 text-amber-700',
    medium: 'border-blue-200 bg-blue-50 text-blue-700',
    low: 'border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-muted)]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[priority] ?? map.medium}`}
    >
      {priority}
    </span>
  );
}

function RunStatusPill({ status }: { status: string }): JSX.Element {
  const map: Record<string, string> = {
    passed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    failed: 'border-red-200 bg-red-50 text-red-700',
    errored: 'border-amber-200 bg-amber-50 text-amber-700',
    running: 'border-blue-200 bg-blue-50 text-blue-700',
    pending: 'border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-muted)]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] ?? 'border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-muted)]'}`}
    >
      {status}
    </span>
  );
}

function ReliabilityPill({ status }: { status: string }): JSX.Element {
  const map: Record<string, string> = {
    stable: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    suspected_flaky: 'border-amber-200 bg-amber-50 text-amber-700',
    flaky: 'border-amber-300 bg-amber-100 text-amber-800',
    unstable: 'border-red-200 bg-red-50 text-red-700',
    insufficient_data: 'border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-muted)]',
  };
  const label: Record<string, string> = {
    suspected_flaky: 'suspected flaky',
    insufficient_data: 'insufficient data',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] ?? map.insufficient_data}`}
    >
      {status === 'flaky' && <IconAlertTriangle size={10} />}
      {label[status] ?? status}
    </span>
  );
}
