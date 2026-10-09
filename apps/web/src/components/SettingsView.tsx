import { useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '@ai-bug-hunter/shared';
import { CiTokensView } from './CiTokensView.js';
import { ThemedPageHeader } from './shared/ThemedPageHeader.js';
import { useTheme } from '../lib/theme.js';
import { IconCog, IconPalette, IconSparkles, IconUser, IconCodeBrackets, IconDatabase, IconRocket, IconLogout } from './icons.js';
import { entryFor } from './navigation.js';
import { UserAvatar } from './shared/UserAvatar.js';
import type { ReactNode } from 'react';

interface Props {
  user: AuthUser | null;
  onLogout?: () => void;
  onOpenTour?: () => void;
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

export function SettingsView({ user, onLogout, onOpenTour }: Props): JSX.Element {
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

  const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'qa_engineer' ? 'QA Engineer' : 'Viewer';

  return (
    <div className="space-y-6">
      <ThemedPageHeader
        eyebrow="SYSTEM CONTROL CENTER"
        title="System Settings"
        subtitle={
          user.role === 'admin'
            ? 'Manage appearance, AI engine, account, CI integration and data retention.'
            : 'Manage appearance and account preferences.'
        }
        icon={<IconCog size={22} />}
        guide={entryFor('settings').guide}
      />

      {/* Profile banner */}
      <section className="abh-card abh-fade-up relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(500px 200px at 0% 0%, var(--primary-soft), transparent 70%)' }}
        />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="relative">
            <span aria-hidden className="absolute inset-0 rounded-2xl blur-xl" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', opacity: 0.5 }} />
            <UserAvatar user={user} size={64} rounded="rounded-2xl" className="relative" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-[var(--text)]">{user.displayName ?? user.email}</div>
            {user.displayName && <div className="truncate text-sm text-[var(--text-muted)]">{user.email}</div>}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 font-semibold uppercase tracking-wider text-[var(--primary-strong)]">
                {roleLabel}
              </span>
              <span className="flex items-center gap-1.5 text-[var(--success)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" /> Session active
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onOpenTour && (
              <button type="button" onClick={onOpenTour} className="abh-btn abh-btn-ghost">
                <IconRocket size={14} /> Replay quick start
              </button>
            )}
            {onLogout && (
              <button type="button" onClick={onLogout} className="abh-btn abh-btn-ghost">
                <IconLogout size={14} /> Log out of this device
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel eyebrow="APPEARANCE" icon={<IconPalette size={14} />}>
          <div className="text-sm font-medium text-[var(--text)]">Theme</div>
          <p className="text-xs text-[var(--text-muted)]">
            Switch between the cinematic dark palette and a clean daylight mode. Your choice
            is remembered on this device.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label="Theme mode">
            {(['dark', 'light'] as const).map((t) => {
              const on = theme === t;
              const bg = t === 'dark' ? '#05060b' : '#f5f6fa';
              const card = t === 'dark' ? '#10121c' : '#ffffff';
              const line = t === 'dark' ? 'rgba(255,255,255,0.12)' : '#e3e6ef';
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  aria-pressed={on}
                  className={`group rounded-xl border p-2 text-left transition-all ${
                    on
                      ? 'border-[var(--primary)] shadow-[0_8px_24px_-14px_var(--primary)]'
                      : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="overflow-hidden rounded-lg border" style={{ background: bg, borderColor: line }}>
                    <div className="flex h-20 gap-1.5 p-2">
                      <div className="w-6 rounded" style={{ background: card, border: `1px solid ${line}` }} />
                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className="h-2 w-2/3 rounded" style={{ background: t === 'dark' ? '#8b5cf6' : '#6d28d9' }} />
                        <div className="flex flex-1 gap-1.5">
                          <div className="flex-1 rounded" style={{ background: card, border: `1px solid ${line}` }} />
                          <div className="flex-1 rounded" style={{ background: card, border: `1px solid ${line}` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">{t}</span>
                    <span
                      className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${on ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-[var(--border)]'}`}
                    />
                  </div>
                </button>
              );
            })}
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

        <Panel eyebrow="ACCOUNT" icon={<IconUser size={14} />}>
          <dl className="grid grid-cols-1 gap-1 text-sm">
            <Row label="Email" value={user.email} />
            <Row
              label="Role"
              value={user.role}
              tone={user.role === 'admin' ? 'primary' : 'muted'}
            />
            <Row label="Session" value="● Active" tone="success" />
          </dl>
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3 text-xs text-[var(--text-muted)]">
            {user.role === 'admin'
              ? 'Admins can manage every application, CI tokens and data retention.'
              : user.role === 'qa_engineer'
                ? 'QA engineers can add applications, generate and run tests, and launch campaigns.'
                : 'Viewers can browse results. Ask an admin for QA engineer access to run tests.'}
          </div>
        </Panel>
      </div>

      {user.role === 'admin' && (
        <Panel eyebrow="AI ENGINE" icon={<IconSparkles size={14} />}>
          {error ? (
            <div className="text-sm text-[var(--danger)]">Failed to load: {error}</div>
          ) : !snapshot ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="abh-skeleton h-6 rounded" />)}
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-1 text-sm md:grid-cols-2">
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
      )}

      {user.role === 'admin' && (
        <Panel eyebrow="CI INTEGRATION" icon={<IconCodeBrackets size={14} />}>
          <CiTokensView />
        </Panel>
      )}

      {user.role === 'admin' && (
        <Panel eyebrow="DATA RETENTION" icon={<IconDatabase size={14} />}>
          {!snapshot ? (
            <div className="abh-skeleton h-6 w-48 rounded" />
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
      )}
    </div>
  );
}

function Panel({
  eyebrow,
  icon,
  children,
}: {
  eyebrow: string;
  icon?: ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="abh-card abh-fade-up p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)]"
        >
          {icon ?? <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />}
        </span>
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
    <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2 last:border-0">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className={`truncate font-mono text-[13px] ${toneClass}`}>{value}</dd>
    </div>
  );
}
