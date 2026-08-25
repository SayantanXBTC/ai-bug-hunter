import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { IconSparkles, IconSpinner, IconXMark, IconAlertTriangle, IconCheck, IconChevronRight } from '../icons.js';
import { maskFieldValue } from '../../lib/sanitize.js';
import type {
  ApplicationOption,
  GenerationResponse,
  ValidatedGeneratedTest,
} from './types.js';

interface GenerateTestsModalProps {
  open: boolean;
  applications: ApplicationOption[];
  defaultApplicationId?: string | null;
  onClose: () => void;
  onSaved: (savedCount: number) => void;
  onNavigateToApplications?: (applicationId: string) => void;
}

const GOALS = ['smoke', 'functional', 'negative', 'validation', 'navigation', 'exploratory'] as const;

type Goal = (typeof GOALS)[number];

type PreflightState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'no-discovery' }
  | { kind: 'ready'; applicationModel: Record<string, unknown>; pagePaths: string[] };

export function GenerateTestsModal({
  open,
  applications,
  defaultApplicationId,
  onClose,
  onSaved,
  onNavigateToApplications,
}: GenerateTestsModalProps): JSX.Element | null {
  const [applicationId, setApplicationId] = useState<string>(defaultApplicationId ?? '');
  const [goal, setGoal] = useState<Goal>('smoke');
  const [maxTests, setMaxTests] = useState<number>(5);
  const [targetPage, setTargetPage] = useState<string>('');
  const [preflight, setPreflight] = useState<PreflightState>({ kind: 'idle' });
  const [generating, setGenerating] = useState(false);
  const [response, setResponse] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFocusRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!open) {
      setPreflight({ kind: 'idle' });
      setResponse(null);
      setError(null);
      setSelected(new Set());
      setExpanded(new Set());
      setGenerating(false);
      setSaving(false);
      setApplicationId(defaultApplicationId ?? '');
      setGoal('smoke');
      setMaxTests(5);
      setTargetPage('');
      return undefined;
    }
    const t = window.setTimeout(() => firstFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, defaultApplicationId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'input, button, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const runPreflight = async (): Promise<PreflightState> => {
    setPreflight({ kind: 'checking' });
    // The AI route requires a discovery-derived ApplicationModel. Attempt a
    // discovery call using the selected application's baseUrl. The backend
    // may cache; on failure we surface the "discover first" pre-flight state.
    const app = applications.find((a) => a.id === applicationId);
    if (!app) {
      setPreflight({ kind: 'no-discovery' });
      return { kind: 'no-discovery' };
    }
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseUrl: app.base_url, maxPages: 5 }),
      });
      if (!res.ok) {
        setPreflight({ kind: 'no-discovery' });
        return { kind: 'no-discovery' };
      }
      const body = (await res.json()) as {
        application?: { pages?: Array<{ path?: string }> };
      };
      const applicationModel = body.application as Record<string, unknown> | undefined;
      if (!applicationModel) {
        setPreflight({ kind: 'no-discovery' });
        return { kind: 'no-discovery' };
      }
      const pagePaths = (body.application?.pages ?? [])
        .map((p) => p?.path)
        .filter((p): p is string => typeof p === 'string');
      const ready: PreflightState = { kind: 'ready', applicationModel, pagePaths };
      setPreflight(ready);
      return ready;
    } catch {
      setPreflight({ kind: 'no-discovery' });
      return { kind: 'no-discovery' };
    }
  };

  const generate = async (): Promise<void> => {
    setError(null);
    setResponse(null);
    setSelected(new Set());
    setExpanded(new Set());
    let pf = preflight;
    if (pf.kind !== 'ready') {
      pf = await runPreflight();
    }
    if (pf.kind !== 'ready') return;
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-tests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          applicationModel: pf.applicationModel,
          goal,
          maxTests,
          ...(targetPage ? { targetPage } : {}),
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string; message?: string };
          if (body?.error) msg = body.error;
          else if (body?.message) msg = body.message;
        } catch {
          // ignore
        }
        setError(msg);
        return;
      }
      const body = (await res.json()) as GenerationResponse;
      setResponse(body);
      // Auto-select all valid tests
      const validIds = body.tests
        .filter((t) => t.validationStatus === 'valid')
        .map((t) => t.test.id);
      setSelected(new Set(validIds));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveSelected = async (): Promise<void> => {
    if (!response) return;
    const chosen = response.tests.filter(
      (t) => selected.has(t.test.id) && t.validationStatus === 'valid',
    );
    if (chosen.length === 0) return;
    setSaving(true);
    let savedCount = 0;
    try {
      for (const t of chosen) {
        try {
          const res = await fetch('/api/test-cases', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              applicationId: applicationId || undefined,
              name: t.test.name,
              description: t.description,
              definition: t.test,
              source: 'generated',
              tags: ['ai-generated', goal],
            }),
          });
          if (res.ok) savedCount += 1;
        } catch {
          // continue with next
        }
      }
      onSaved(savedCount);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const app = applications.find((a) => a.id === applicationId);
  const validCount = response?.tests.filter((t) => t.validationStatus === 'valid').length ?? 0;
  const invalidCount = response?.tests.filter((t) => t.validationStatus === 'invalid').length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gen-tests-title"
        onKeyDown={onKeyDown}
        className="my-8 w-full max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-600"
            >
              <IconSparkles size={14} />
            </span>
            <div>
              <h2 id="gen-tests-title" className="text-base font-semibold text-[var(--text)]">
                Generate Tests
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Claude proposes candidate tests from the discovered application model.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[var(--text-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <IconXMark size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
            <div className="font-medium">How generation works</div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-violet-800">
              <PipelineStep label="Application model" />
              <IconChevronRight size={12} />
              <PipelineStep label="Claude" accent />
              <IconChevronRight size={12} />
              <PipelineStep label="Candidate tests" />
              <IconChevronRight size={12} />
              <PipelineStep label="Schema validation" />
              <IconChevronRight size={12} />
              <PipelineStep label="Business rules" />
              <IconChevronRight size={12} />
              <PipelineStep label="Executable" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col text-xs font-medium text-[var(--text)]">
              Application <span className="text-red-500">*</span>
              <select
                ref={firstFocusRef}
                value={applicationId}
                onChange={(e) => {
                  setApplicationId(e.target.value);
                  setPreflight({ kind: 'idle' });
                  setResponse(null);
                }}
                className="mt-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <option value="">Select an application…</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-xs font-medium text-[var(--text)]">
              Goal
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as Goal)}
                className="mt-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
              >
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-xs font-medium text-[var(--text)]">
              Max tests
              <input
                type="number"
                min={1}
                max={20}
                value={maxTests}
                onChange={(e) => setMaxTests(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="mt-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums text-[var(--text)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
              />
            </label>

            <label className="flex flex-col text-xs font-medium text-[var(--text)]">
              Target page (optional)
              {preflight.kind === 'ready' && preflight.pagePaths.length > 0 ? (
                <select
                  value={targetPage}
                  onChange={(e) => setTargetPage(e.target.value)}
                  className="mt-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <option value="">(any)</option>
                  {preflight.pagePaths.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="/checkout"
                  value={targetPage}
                  onChange={(e) => setTargetPage(e.target.value)}
                  className="mt-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 font-mono text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
                />
              )}
            </label>
          </div>

          {preflight.kind === 'no-discovery' && app && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                Discover this application before generating tests.
              </div>
              {onNavigateToApplications && (
                <button
                  type="button"
                  onClick={() => onNavigateToApplications(app.id)}
                  className="rounded border border-amber-300 bg-[var(--surface)] px-2 py-0.5 font-medium text-amber-800 hover:bg-amber-100"
                >
                  Discover Application
                </button>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button
                type="button"
                onClick={() => void generate()}
                className="rounded border border-red-300 bg-[var(--surface)] px-2 py-0.5 font-medium text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {response && response.status === 'provider_error' && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <div className="font-medium">AI provider error</div>
              {response.message && <div className="mt-1">{response.message}</div>}
            </div>
          )}

          {response && response.status === 'validation_error' && (
            <div
              role="alert"
              className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              <div className="font-medium">Generation blocked</div>
              {response.message && <div className="mt-1">{response.message}</div>}
              <div className="mt-2 text-[11px] text-amber-700/80">
                Tip: pick a specific target page above, or reduce Max Tests, so the
                prompt fits under the size limit.
              </div>
            </div>
          )}

          {response && response.status === 'success' && (
            <div className="space-y-3">
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text)]">
                  Generated {response.tests.length}
                </span>
                {' · '}
                <span>Valid {validCount}</span>
                {invalidCount > 0 && <> {' · '}<span>Rejected {invalidCount}</span></>}
                {response.provider && (
                  <>
                    {' · '}
                    <span className="text-[var(--text-muted)]">
                      {response.provider}/{response.model}
                    </span>
                  </>
                )}
              </div>

              {response.warnings.length > 0 && (
                <ul className="space-y-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {response.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}

              <ul className="space-y-2">
                {response.tests.map((t) => (
                  <GeneratedTestCard
                    key={t.test.id}
                    t={t}
                    selected={selected.has(t.test.id)}
                    expanded={expanded.has(t.test.id)}
                    onToggleSelect={() => toggleSelect(t.test.id)}
                    onToggleExpand={() => toggleExpand(t.test.id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-60"
          >
            Cancel
          </button>
          {response?.status === 'success' ? (
            <button
              type="button"
              onClick={() => void saveSelected()}
              disabled={saving || selected.size === 0}
              className="inline-flex items-center gap-1.5 rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60"
            >
              {saving && <IconSpinner size={14} />}
              {saving ? 'Saving…' : `Save Selected (${selected.size})`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void generate()}
              disabled={generating || !applicationId || preflight.kind === 'checking'}
              className="inline-flex items-center gap-1.5 rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60"
            >
              {generating || preflight.kind === 'checking' ? (
                <>
                  <IconSpinner size={14} />
                  {preflight.kind === 'checking'
                    ? 'Preparing model…'
                    : 'Claude is generating candidate tests…'}
                </>
              ) : (
                <>
                  <IconSparkles size={14} />
                  Generate
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineStep({ label, accent }: { label: string; accent?: boolean }): JSX.Element {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 ${
        accent ? 'bg-violet-600 text-white' : 'bg-[var(--surface)] text-violet-900 ring-1 ring-violet-200'
      }`}
    >
      {label}
    </span>
  );
}

interface GeneratedCardProps {
  t: ValidatedGeneratedTest;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
}

function GeneratedTestCard({
  t,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
}: GeneratedCardProps): JSX.Element {
  const valid = t.validationStatus === 'valid';
  return (
    <li className="rounded border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={!valid}
          onChange={onToggleSelect}
          aria-label={`Select ${t.test.name}`}
          className="mt-1 h-4 w-4 rounded border-[var(--border)] text-violet-600 focus:ring-violet-400"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-semibold text-[var(--text)]">{t.test.name}</div>
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
              <IconSparkles size={10} />
              AI Generated
            </span>
            {valid ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  <IconCheck size={10} /> Schema valid
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  <IconCheck size={10} /> Business rules valid
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                Rejected
              </span>
            )}
          </div>
          {t.description && (
            <div className="mt-1 text-xs text-[var(--text-muted)]">{t.description}</div>
          )}
          <div className="mt-1 text-[11px] text-[var(--text-subtle)]">
            {t.test.steps.length} step{t.test.steps.length === 1 ? '' : 's'}
          </div>
          {!valid && t.issues.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-red-600">
              {t.issues.slice(0, 3).map((issue, i) => (
                <li key={i}>
                  {issue.kind}: {issue.message}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2">
            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
              aria-expanded={expanded}
            >
              {expanded ? 'Hide' : 'Review'} steps
            </button>
          </div>
          {expanded && (
            <ol className="mt-2 space-y-1 rounded border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-[11px] text-[var(--text)]">
              {t.test.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="tabular-nums text-[var(--text-subtle)]">{i + 1}.</span>
                  <span className="font-medium text-violet-700">{s.action}</span>
                  {typeof s.selector === 'string' && (
                    <span className="font-mono text-[var(--text-muted)]">{s.selector}</span>
                  )}
                  {typeof s.url === 'string' && (
                    <span className="font-mono text-[var(--text-muted)]">{s.url}</span>
                  )}
                  {s.action === 'fill' && typeof s.value === 'string' && (
                    <span className="text-[var(--text-muted)]">
                      = {maskFieldValue(typeof s.selector === 'string' ? s.selector : '', s.value)}
                    </span>
                  )}
                  {s.action === 'selectOption' && typeof s.value === 'string' && (
                    <span className="text-[var(--text-muted)]">= {s.value}</span>
                  )}
                  {s.action === 'press' && typeof s.key === 'string' && (
                    <span className="text-[var(--text-muted)]">key {s.key}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </li>
  );
}
