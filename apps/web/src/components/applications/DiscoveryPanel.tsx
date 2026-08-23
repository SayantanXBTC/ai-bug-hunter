import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IconSpinner, IconXMark, IconAlertTriangle, IconSparkles, IconCheck } from '../icons.js';
import { formatNumber, formatDuration } from '../../lib/format.js';
import type { DiscoveryResult } from './types.js';

interface DiscoveryPanelProps {
  open: boolean;
  applicationBaseUrl: string;
  onClose: () => void;
  onComplete: (result: DiscoveryResult) => void;
  onGenerateTests?: () => void;
}

export function DiscoveryPanel({
  open,
  applicationBaseUrl,
  onClose,
  onComplete,
  onGenerateTests,
}: DiscoveryPanelProps): JSX.Element | null {
  const [baseUrl, setBaseUrl] = useState(applicationBaseUrl);
  const [maxPages, setMaxPages] = useState(5);
  const [maxDepth, setMaxDepth] = useState(2);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    setBaseUrl(applicationBaseUrl);
    setError(null);
    setResult(null);
    setRunning(false);
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, applicationBaseUrl]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape' && !running) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, running]);

  if (!open) return null;

  const submit = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    if (!/^https?:\/\//i.test(baseUrl.trim())) {
      setError('Base URL must start with http:// or https://');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), maxPages, maxDepth }),
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
        throw new Error(msg);
      }
      const parsed = (await res.json()) as DiscoveryResult;
      setResult(parsed);
      onComplete(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !running) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discovery-title"
        className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]"
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 id="discovery-title" className="text-base font-semibold text-[var(--text)]">Discover Application</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              AI Bug Hunter will crawl the application and build a structured application model
              containing pages, forms, links, interactive elements, and selector candidates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={running}
            className="rounded p-1 text-[var(--text-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-40"
          >
            <IconXMark size={16} />
          </button>
        </div>

        {!result ? (
          <form onSubmit={submit} className="space-y-4 px-5 py-4">
            <div>
              <label htmlFor="disco-url" className="block text-xs font-medium text-[var(--text)]">Base URL</label>
              <input
                id="disco-url"
                ref={firstInputRef}
                type="url"
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={running}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="disco-pages" className="block text-xs font-medium text-[var(--text)]">Max Pages</label>
                <input
                  id="disco-pages"
                  type="number"
                  min={1}
                  max={100}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  disabled={running}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm tabular-nums text-[var(--text)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
                />
                <p className="mt-1 text-xs text-[var(--text-subtle)]">1–100</p>
              </div>
              <div>
                <label htmlFor="disco-depth" className="block text-xs font-medium text-[var(--text)]">Max Depth</label>
                <input
                  id="disco-depth"
                  type="number"
                  min={0}
                  max={10}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  disabled={running}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm tabular-nums text-[var(--text)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
                />
                <p className="mt-1 text-xs text-[var(--text-subtle)]">0–10</p>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            {running && (
              <div className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-xs text-[var(--text-muted)]" aria-live="polite">
                <IconSpinner size={14} />
                <span>Discovering application… this may take up to 30 seconds.</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={running}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={running}
                className="inline-flex items-center gap-1.5 rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-60"
              >
                {running && <IconSpinner size={14} />}
                {running ? 'Discovering…' : 'Start Discovery'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <IconCheck size={16} />
              <span>Discovery complete.</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <SummaryStat label="Pages" value={formatNumber(result.stats.pagesDiscovered)} />
              <SummaryStat label="Forms" value={formatNumber(result.stats.forms)} />
              <SummaryStat label="Elements" value={formatNumber(result.stats.interactiveElements)} />
              <SummaryStat label="Links" value={formatNumber(result.stats.linksFound)} />
              <SummaryStat label="Duration" value={formatDuration(result.stats.crawlDurationMs)} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus-visible:ring-[var(--primary)]"
              >
                Close
              </button>
              {onGenerateTests && (
                <button
                  type="button"
                  onClick={() => {
                    onGenerateTests();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <IconSparkles size={14} />
                  Generate Tests
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--text)]">{value}</div>
    </div>
  );
}
