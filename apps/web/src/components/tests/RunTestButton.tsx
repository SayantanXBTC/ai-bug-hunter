import { useState } from 'react';
import { IconPlay, IconSpinner, IconCheck, IconX, IconAlertTriangle, IconExternalLink } from '../icons.js';
import type { TestCaseRow, TestRunDetailResponse } from './types.js';

interface RunTestButtonProps {
  testCase: TestCaseRow;
  disabled?: boolean;
  size?: 'sm' | 'md';
  onNavigateToRun?: (runId: string) => void;
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; status: string; runId: string }
  | { kind: 'error'; message: string };

const TERMINAL = new Set(['passed', 'failed', 'errored', 'skipped']);

export function RunTestButton({
  testCase,
  disabled = false,
  size = 'sm',
  onNavigateToRun,
}: RunTestButtonProps): JSX.Element {
  const [state, setState] = useState<RunState>({ kind: 'idle' });

  const start = async (): Promise<void> => {
    setState({ kind: 'running' });
    try {
      const res = await fetch('/api/test-runs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...testCase.definition, testCaseId: testCase.id }),
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
        setState({ kind: 'error', message: msg });
        return;
      }
      const body = (await res.json()) as TestRunDetailResponse;
      // The API executes synchronously and returns the persisted run; if the
      // status is not yet terminal (unusual), poll GET /api/test-runs/:id.
      if (TERMINAL.has(body.status)) {
        setState({ kind: 'done', status: body.status, runId: body.id });
        return;
      }
      const finalStatus = await pollRunStatus(body.id);
      setState({ kind: 'done', status: finalStatus, runId: body.id });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Execution failed' });
    }
  };

  const padding = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';

  if (state.kind === 'running') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded bg-violet-600 ${padding} font-medium text-white`}
      >
        <IconSpinner size={12} />
        Running test…
      </span>
    );
  }

  if (state.kind === 'done') {
    const passed = state.status === 'passed';
    const errored = state.status === 'errored';
    const label = passed ? 'Test passed' : errored ? 'Execution error' : 'Test failed';
    const cls = passed
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : errored
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700';
    const Icon = passed ? IconCheck : errored ? IconAlertTriangle : IconX;
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded border ${cls} ${padding} font-medium`}
        >
          <Icon size={12} />
          {label}
        </span>
        {onNavigateToRun ? (
          <button
            type="button"
            onClick={() => onNavigateToRun(state.runId)}
            className={`inline-flex items-center gap-1 rounded border border-neutral-300 bg-white ${padding} font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400`}
          >
            <IconExternalLink size={12} />
            View Run
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setState({ kind: 'idle' })}
          className={`inline-flex items-center gap-1 rounded border border-neutral-200 bg-white ${padding} font-medium text-neutral-600 hover:bg-neutral-50`}
        >
          Reset
        </button>
      </span>
    );
  }

  if (state.kind === 'error') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span
          role="alert"
          className={`inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 ${padding} font-medium text-amber-700`}
        >
          <IconAlertTriangle size={12} />
          {state.message}
        </span>
        <button
          type="button"
          onClick={() => void start()}
          className={`inline-flex items-center gap-1 rounded border border-neutral-300 bg-white ${padding} font-medium text-neutral-700 hover:bg-neutral-50`}
        >
          Retry
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded bg-violet-600 ${padding} font-medium text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60`}
    >
      <IconPlay size={12} />
      Run Test
    </button>
  );
}

async function pollRunStatus(id: string): Promise<string> {
  // Poll up to ~60s, backend usually returns terminal status immediately.
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`/api/test-runs/${encodeURIComponent(id)}`, {
        credentials: 'include',
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { status: string };
      if (TERMINAL.has(body.status)) return body.status;
    } catch {
      // ignore, keep polling
    }
  }
  return 'pending';
}
