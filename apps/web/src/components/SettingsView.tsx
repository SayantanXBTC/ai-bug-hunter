import { useEffect, useState } from 'react';
import type { AuthUser } from '@ai-bug-hunter/shared';
import { CiTokensView } from './CiTokensView.js';

interface Props {
  user: AuthUser | null;
}

interface SettingsSnapshot {
  configuredVia: string;
  llm: {
    provider: string;
    model: string;
    enabled: boolean;
    apiKeyConfigured: boolean;
    apiKeyMasked?: string;
  };
  rateLimits: Record<string, number>;
  retention: { enabled: boolean };
  registration: { allow: boolean; defaultRole: string };
}

export function SettingsView({ user }: Props): JSX.Element {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    (async () => {
      try {
        const res = await fetch('/api/admin/settings', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSnapshot(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'error');
      }
    })();
  }, [user]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm text-slate-600">
        You don&apos;t have access to Settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Configuration</h2>
        {error && <div className="text-sm text-rose-600">Failed to load: {error}</div>}
        {!snapshot && !error && <div className="text-sm text-slate-500">Loading…</div>}
        {snapshot && (
          <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <Row label="Configured via" value={snapshot.configuredVia} />
            <Row label="LLM provider" value={snapshot.llm.provider} />
            <Row label="LLM model" value={snapshot.llm.model} />
            <Row label="LLM enabled" value={String(snapshot.llm.enabled)} />
            <Row
              label="API key"
              value={snapshot.llm.apiKeyConfigured ? snapshot.llm.apiKeyMasked ?? 'configured' : 'not configured'}
            />
            <Row label="Retention enabled" value={String(snapshot.retention.enabled)} />
            <Row label="Registration allowed" value={String(snapshot.registration.allow)} />
            <Row label="Default role" value={snapshot.registration.defaultRole} />
          </dl>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Settings are read-only and configured via environment variables.
        </p>
      </section>

      <CiTokensView />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between border-b py-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-mono text-slate-800">{value}</dd>
    </div>
  );
}
