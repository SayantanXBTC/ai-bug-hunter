import { useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '@ai-bug-hunter/shared';
import { CiTokensView } from './CiTokensView.js';
import { ThemedPageHeader } from './shared/ThemedPageHeader.js';
import { useTheme } from '../lib/theme.js';

interface Props {
  user: AuthUser | null;
  onLogout?: () => void;
}

interface SettingsSnapshot {
  configuredVia: string;
  llm: {
    provider: string;
    model: string;
    enabled: boolean;
    apiKeyConfigured: boolean;
    apiKeyMasked?: string;
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
  };
  rateLimits: Record<string, number>;
  retention: { enabled: boolean };
  registration: { allow: boolean; defaultRole: string };
}

export function SettingsView({ user, onLogout }: Props): JSX.Element {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }, []);

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
    })().catch(() => undefined);
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text-muted)]">
        You must be signed in to view Settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ThemedPageHeader
        eyebrow="SYSTEM CONTROL CENTER"
        title="System Settings"
        subtitle="Manage appearance, AI engine, account, CI integration and data retention."
      />

      <Panel eyebrow="APPEARANCE">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-[var(--text)]">Theme</div>
            <p className="text-xs text-[var(--text-muted)]">
              Switch between the cinematic dark palette and a clean daylight mode. Your choice
              is remembered on this device.
            </p>
          </div>
          <div
            className="inline-flex overflow-hidden rounded border border-[var(--border)] bg-[var(--surface-elevated)]"
            role="group"
            aria-label="Theme mode"
          >
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                aria-pressed={theme === t}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                  theme === t
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: reducedMotion ? 'var(--warning)' : 'var(--success)' }}
            aria-hidden
          />
          Reduced motion: <span className="font-mono">{reducedMotion ? 'enabled' : 'disabled'}</span>
          <span className="text-[var(--text-subtle)]">(from system preference)</span>
        </div>
      </Panel>

      <Panel eyebrow="AI ENGINE">
        {user.role !== 'admin' ? (
          <div className="text-xs text-[var(--text-subtle)]">
            AI Engine configuration is visible to administrators only.
          </div>
        ) : error ? (
          <div className="text-sm text-[var(--danger)]">Failed to load: {error}</div>
        ) : !snapshot ? (
          <div className="text-sm text-[var(--text-muted)]">Loading…</div>
        ) : (
          <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <Row label="Provider" value={snapshot.llm.provider} />
            <Row label="Model" value={snapshot.llm.model} />
            <Row label="Enabled" value={String(snapshot.llm.enabled)} />
            <Row
              label="Max tokens"
              value={snapshot.llm.maxTokens === undefined ? '—' : String(snapshot.llm.maxTokens)}
            />
            <Row
              label="Temperature"
              value={
                snapshot.llm.temperature === undefined ? '—' : String(snapshot.llm.temperature)
              }
            />
            <Row
              label="Timeout"
              value={
                snapshot.llm.timeoutMs === undefined ? '—' : `${snapshot.llm.timeoutMs} ms`
              }
            />
            <Row
              label="API key"
              value={
                snapshot.llm.apiKeyConfigured ? '● CONFIGURED' : '○ NOT CONFIGURED'
              }
              tone={snapshot.llm.apiKeyConfigured ? 'success' : 'muted'}
            />
            <Row label="Configured via" value={snapshot.configuredVia} />
          </dl>
        )}
      </Panel>

      <Panel eyebrow="ACCOUNT">
        <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <Row label="Email" value={user.email} />
          <Row
            label="Role"
            value={user.role}
            tone={user.role === 'admin' ? 'primary' : 'muted'}
          />
          <Row label="Session" value="● Active" tone="success" />
        </dl>
        {onLogout && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onLogout}
              className="rounded border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              Log out of this device
            </button>
          </div>
        )}
      </Panel>

      {user.role === 'admin' && (
        <Panel eyebrow="CI INTEGRATION">
          <CiTokensView />
        </Panel>
      )}

      <Panel eyebrow="DATA RETENTION">
        {user.role !== 'admin' ? (
          <div className="text-xs text-[var(--text-subtle)]">
            Retention state is visible to administrators only.
          </div>
        ) : !snapshot ? (
          <div className="text-sm text-[var(--text-muted)]">Loading…</div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: snapshot.retention.enabled ? 'var(--success)' : 'var(--text-subtle)',
              }}
              aria-hidden
            />
            <span
              className={`font-mono text-[10px] font-semibold uppercase tracking-[0.25em] ${
                snapshot.retention.enabled ? 'text-[var(--success)]' : 'text-[var(--text-subtle)]'
              }`}
            >
              {snapshot.retention.enabled ? 'Retention active' : 'Retention disabled'}
            </span>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <div className="mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-2">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]"
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-subtle)]">
          {eyebrow}
        </span>
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'muted' | 'primary';
}): JSX.Element {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--success)]'
      : tone === 'primary'
        ? 'text-[var(--primary)]'
        : tone === 'muted'
          ? 'text-[var(--text-muted)]'
          : 'text-[var(--text)]';
  return (
    <div className="flex justify-between border-b border-[var(--border)] py-1">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className={`font-mono ${toneClass}`}>{value}</dd>
    </div>
  );
}
