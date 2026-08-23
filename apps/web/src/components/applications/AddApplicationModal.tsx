import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { IconSpinner, IconXMark, IconAlertTriangle } from '../icons.js';

interface AddApplicationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface FormState {
  name: string;
  baseUrl: string;
}

export function AddApplicationModal({ open, onClose, onCreated }: AddApplicationModalProps): JSX.Element | null {
  const [form, setForm] = useState<FormState>({ name: '', baseUrl: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setForm({ name: '', baseUrl: '' });
      setError(null);
      setClientError(null);
      setSubmitting(false);
      return undefined;
    }
    // focus first input on open
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

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

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Name is required.';
    const url = form.baseUrl.trim();
    if (!url) return 'Base URL is required.';
    if (!/^https?:\/\//i.test(url)) return 'Base URL must start with http:// or https://';
    return null;
  };

  const submit = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    const v = validate();
    if (v) {
      setClientError(v);
      return;
    }
    setClientError(null);
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), baseUrl: form.baseUrl.trim() }),
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
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create application');
    } finally {
      setSubmitting(false);
    }
  };

  const onDialogKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    // Basic focus trap: cycle Tab between focusables inside dialog
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])',
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-app-title"
        onKeyDown={onDialogKeyDown}
        className="w-full max-w-md rounded-lg border border-neutral-200 bg-white shadow-lg"
      >
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 id="add-app-title" className="text-base font-semibold text-neutral-900">Add Application</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Register an application to run discovery and tests against.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-400"
          >
            <IconXMark size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="app-name" className="block text-xs font-medium text-neutral-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="app-name"
              ref={firstInputRef}
              type="text"
              autoComplete="off"
              placeholder="e.g. Acme Web"
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="app-url" className="block text-xs font-medium text-neutral-700">
              Base URL <span className="text-red-500">*</span>
            </label>
            <input
              id="app-url"
              type="url"
              autoComplete="off"
              placeholder="https://example.com"
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-neutral-500">Must begin with http:// or https://</p>
          </div>

          {clientError && (
            <div role="alert" className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {clientError}
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button
                type="button"
                onClick={() => void submit()}
                className="rounded border border-red-300 bg-white px-2 py-0.5 text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-60"
            >
              {submitting && <IconSpinner size={14} />}
              {submitting ? 'Adding…' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
