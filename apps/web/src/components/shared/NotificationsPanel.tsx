import { useEffect, useState } from 'react';
import { formatRelativeTime } from '../../lib/format.js';

interface NotificationItem {
  id: string;
  kind: 'run_failed' | 'run_passed' | 'cluster' | 'campaign';
  title: string;
  subtitle: string;
  timestamp: string; // ISO
  targetView: string;
  targetId?: string;
}

interface NotificationsPanelProps {
  onNavigate?: (view: string, id?: string) => void;
  onLoaded?: (unreadCount: number) => void;
}

interface TestRunSummary {
  id: string;
  test_name?: string;
  status: string;
  finished_at?: string | null;
  started_at?: string | null;
  error_name?: string | null;
}

interface ClusterSummary {
  id: string;
  fingerprint_summary?: string | null;
  severity?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
  updated_at?: string | null;
  occurrence_count?: number;
}

interface CampaignSummary {
  id: string;
  name?: string | null;
  quality?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

const READ_KEY = 'abh-notifications-read-at';

function readLastSeen(): number {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? Number.parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}
function writeLastSeen(ts: number): void {
  try {
    localStorage.setItem(READ_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function toIso(v: string | null | undefined): string {
  if (!v) return new Date(0).toISOString();
  return typeof v === 'string' ? v : new Date().toISOString();
}

export function NotificationsPanel({ onNavigate, onLoaded }: NotificationsPanelProps): JSX.Element {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [runs, clusters, campaigns] = await Promise.all([
        fetchJson<{ items?: TestRunSummary[] }>('/api/test-runs?limit=10'),
        fetchJson<{ items?: ClusterSummary[] }>('/api/ai/bug-intelligence/clusters?limit=5'),
        fetchJson<{ items?: CampaignSummary[] }>('/api/regression-campaigns?limit=5'),
      ]);
      if (cancelled) return;

      const combined: NotificationItem[] = [];

      for (const r of runs?.items ?? []) {
        if (r.status === 'failed' || r.status === 'error') {
          combined.push({
            id: `run-${r.id}`,
            kind: 'run_failed',
            title: r.test_name ?? 'Test failed',
            subtitle: r.error_name ?? 'Execution failure',
            timestamp: toIso(r.finished_at ?? r.started_at),
            targetView: 'test-runs',
            targetId: r.id,
          });
        }
      }
      for (const c of clusters?.items ?? []) {
        combined.push({
          id: `cluster-${c.id}`,
          kind: 'cluster',
          title: c.fingerprint_summary ?? 'Bug cluster',
          subtitle: `${c.severity ?? 'unknown'} · ${c.occurrence_count ?? 0} occurrence${(c.occurrence_count ?? 0) === 1 ? '' : 's'}`,
          timestamp: toIso(c.last_seen_at ?? c.updated_at),
          targetView: 'bugs',
          targetId: c.id,
        });
      }
      for (const camp of campaigns?.items ?? []) {
        combined.push({
          id: `campaign-${camp.id}`,
          kind: 'campaign',
          title: camp.name ?? 'Regression campaign',
          subtitle: `Status ${camp.status ?? '—'} · Quality ${camp.quality ?? '—'}`,
          timestamp: toIso(camp.updated_at ?? camp.created_at),
          targetView: 'regression',
          targetId: camp.id,
        });
      }

      combined.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      const top = combined.slice(0, 10);
      setItems(top);
      if (top.length === 0 && !runs && !clusters && !campaigns) {
        setError('Unable to load notifications');
      }

      const lastSeen = readLastSeen();
      const unread = top.filter((n) => new Date(n.timestamp).getTime() > lastSeen).length;
      onLoaded?.(unread);
    })();
    return () => {
      cancelled = true;
    };
  }, [onLoaded]);

  function markAllRead(): void {
    writeLastSeen(Date.now());
    onLoaded?.(0);
  }

  function KindDot({ kind }: { kind: NotificationItem['kind'] }): JSX.Element {
    const color =
      kind === 'run_failed'
        ? 'bg-[var(--danger)]'
        : kind === 'cluster'
          ? 'bg-[var(--primary)]'
          : kind === 'campaign'
            ? 'bg-[var(--secondary)]'
            : 'bg-[var(--success)]';
    return <span aria-hidden className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Recent activity
        </div>
        <button
          type="button"
          onClick={markAllRead}
          className="text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--primary)]"
        >
          Mark all read
        </button>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {items === null && (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Loading…</div>
        )}
        {items !== null && items.length === 0 && !error && (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            No recent activity yet.
          </div>
        )}
        {error && (
          <div className="px-4 py-8 text-center text-sm text-[var(--danger)]" role="alert">
            {error}
          </div>
        )}
        {items?.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onNavigate?.(n.targetView, n.targetId)}
            className="flex w-full items-start gap-3 border-b border-[var(--border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:bg-[var(--surface-hover)]"
          >
            <KindDot kind={n.kind} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[var(--text)]">{n.title}</div>
              <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{n.subtitle}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--text-subtle)]">
                {formatRelativeTime(n.timestamp)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
