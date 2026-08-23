import { useMemo, useState } from 'react';

interface TestAction {
  action: string;
  [key: string]: unknown;
}

interface TestDefinition {
  id: string;
  name: string;
  targetUrl: string;
  steps: TestAction[];
}

type IssueKind =
  | 'unsupported_action'
  | 'invented_selector'
  | 'out_of_scope_url'
  | 'invalid_url'
  | 'malformed_step'
  | 'duplicate_test';

interface ValidatedGeneratedTest {
  test: TestDefinition;
  description?: string;
  category?: string;
  validationStatus: 'valid' | 'invalid';
  issues: Array<{ kind: IssueKind; message: string; stepIndex?: number; selector?: string; url?: string }>;
}

interface GenerationResponse {
  status: 'success' | 'validation_error' | 'provider_error';
  tests: ValidatedGeneratedTest[];
  warnings: string[];
  provider: string;
  model: string;
  durationMs: number;
  message?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

interface Props {
  applicationModel: unknown | null;
  applicationPagePaths: string[];
}

const GOALS = ['smoke', 'functional', 'negative', 'validation', 'navigation', 'exploratory'] as const;

export function AiGeneration({ applicationModel, applicationPagePaths }: Props): JSX.Element {
  const [goal, setGoal] = useState<(typeof GOALS)[number]>('smoke');
  const [maxTests, setMaxTests] = useState(5);
  const [targetPage, setTargetPage] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<GenerationResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [runOutcomes, setRunOutcomes] = useState<Record<string, { status: string; runId?: string; error?: string }>>({});

  const hasModel = applicationModel !== null;
  const validCount = useMemo(
    () => response?.tests.filter((t) => t.validationStatus === 'valid').length ?? 0,
    [response],
  );

  const generate = async (): Promise<void> => {
    if (!hasModel) return;
    setRunning(true);
    setError(null);
    setResponse(null);
    setSelectedIds(new Set());
    setRunOutcomes({});
    try {
      const res = await fetch('/api/ai/generate-tests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          applicationModel,
          goal,
          maxTests,
          ...(targetPage ? { targetPage } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setResponse((await res.json()) as GenerationResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setRunning(false);
    }
  };

  const runSelected = async (): Promise<void> => {
    if (!response) return;
    const chosen = response.tests.filter(
      (t) => selectedIds.has(t.test.id) && t.validationStatus === 'valid',
    );
    for (const t of chosen) {
      try {
        const res = await fetch('/api/test-runs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(t.test),
        });
        const body = await res.json();
        setRunOutcomes((prev) => ({
          ...prev,
          [t.test.id]: res.ok
            ? { status: body.status, runId: body.id }
            : { status: 'error', error: body?.error ?? `HTTP ${res.status}` },
        }));
      } catch (err) {
        setRunOutcomes((prev) => ({
          ...prev,
          [t.test.id]: { status: 'error', error: err instanceof Error ? err.message : 'unknown' },
        }));
      }
    }
  };

  const toggle = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">AI Test Generation</h2>
        <p className="mt-1 text-sm text-slate-400">
          Generate tests from a discovered ApplicationModel. The LLM proposes; the deterministic
          engine validates and (only when you explicitly click Run) executes.
        </p>
      </div>

      {!hasModel && (
        <div className="text-sm text-slate-400">Run Discovery first to produce an ApplicationModel.</div>
      )}

      {hasModel && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs text-slate-400 flex flex-col">
              Goal
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as (typeof GOALS)[number])}
                className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              >
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400 flex flex-col">
              Max tests
              <input
                type="number"
                min={1}
                max={20}
                value={maxTests}
                onChange={(e) => setMaxTests(Number(e.target.value))}
                className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              />
            </label>
            <label className="text-xs text-slate-400 flex flex-col md:col-span-2">
              Target page (optional)
              <select
                value={targetPage}
                onChange={(e) => setTargetPage(e.target.value)}
                className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              >
                <option value="">(any)</option>
                {applicationPagePaths.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={generate}
            disabled={running}
            className="rounded bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {running ? 'Generating…' : 'Generate Tests'}
          </button>
        </>
      )}

      {error && <div className="text-sm text-rose-400">{error}</div>}

      {response && response.status !== 'success' && (
        <div className="rounded border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-200">
          <div className="font-medium">{response.status}</div>
          {response.message && <div className="text-xs mt-1">{response.message}</div>}
        </div>
      )}

      {response && response.status === 'success' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            {response.provider}/{response.model} · {response.durationMs} ms · {response.tests.length} generated ({validCount} valid)
          </div>

          {response.warnings.length > 0 && (
            <div className="rounded border border-amber-900 bg-amber-950/40 p-2 text-xs text-amber-200">
              {response.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {response.tests.map((t) => {
              const outcome = runOutcomes[t.test.id];
              return (
                <div key={t.test.id} className="border border-slate-800 rounded p-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={t.validationStatus !== 'valid'}
                      checked={selectedIds.has(t.test.id)}
                      onChange={() => toggle(t.test.id)}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="text-slate-100 font-medium">{t.test.name}</div>
                        <div
                          className={
                            t.validationStatus === 'valid'
                              ? 'text-emerald-400 text-xs'
                              : 'text-rose-400 text-xs'
                          }
                        >
                          {t.validationStatus}
                        </div>
                      </div>
                      {t.description && (
                        <div className="text-xs text-slate-400 mt-1">{t.description}</div>
                      )}
                      <div className="text-xs text-slate-500 mt-1 break-all">
                        Target: {t.test.targetUrl}
                      </div>
                      <ol className="mt-2 text-xs text-slate-300 space-y-0.5 list-decimal list-inside">
                        {t.test.steps.map((s, i) => (
                          <li key={i}>
                            <span className="text-brand-500">{s.action}</span>
                            {'selector' in s && typeof s.selector === 'string' ? ` ${s.selector}` : ''}
                            {'url' in s && typeof s.url === 'string' ? ` ${s.url}` : ''}
                            {'value' in s && typeof s.value === 'string' ? ` = <redacted>` : ''}
                          </li>
                        ))}
                      </ol>
                      {t.issues.length > 0 && (
                        <ul className="mt-2 text-xs text-rose-300 list-disc list-inside">
                          {t.issues.map((issue, i) => (
                            <li key={i}>
                              {issue.kind}: {issue.message}
                            </li>
                          ))}
                        </ul>
                      )}
                      {outcome && (
                        <div className="mt-2 text-xs text-slate-300">
                          Run: {outcome.status}
                          {outcome.runId ? ` · ${outcome.runId}` : ''}
                          {outcome.error ? ` · ${outcome.error}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={runSelected}
            disabled={selectedIds.size === 0}
            className="rounded bg-emerald-700 px-4 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Run Selected Tests ({selectedIds.size})
          </button>
        </div>
      )}
    </div>
  );
}
