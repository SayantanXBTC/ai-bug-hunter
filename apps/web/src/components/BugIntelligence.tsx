import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from './shared/PageHeader.js';
import { StatusPill, type PillTone } from './shared/StatusPill.js';
import { IconSparkles, IconSpinner, IconXMark, IconExternalLink, IconBug, IconList } from './icons.js';
import { entryFor } from './navigation.js';
import { useSpotlight } from '../lib/motion.js';
import { OrbitalEmptyState } from './shared/OrbitalEmptyState.js';
import { formatRelativeTime } from '../lib/format.js';

interface BugCluster {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  affectedTestCount: number;
  affectedPageCount: number;
  affectedEndpointCount: number;
  regressionStatus: string;
  primaryFailureSignature: string | null;
  rootCauseSummary: string | null;
  primaryRunId: string | null;
}

interface ListResponse {
  items: BugCluster[];
  page: number;
  limit: number;
  total: number;
}

interface AnalyzeSummary {
  analyzedRuns: number;
  candidatePairs: number;
  aiComparisons: number;
  deterministicStrongPairs: number;
  clustersCreated: number;
  clustersUpdated: number;
  durationMs: number;
}

interface OverviewAiMetrics {
  aiMetrics?: {
    requestCount?: number;
    successCount?: number;
    failureCount?: number;
    provider?: string | null;
    model?: string | null;
    byOperation?: Record<string, unknown>;
  };
}

const STATUS_TONE: Record<string, PillTone> = {
  open: 'error',
  recurring: 'error',
  regressed: 'failed',
  resolved: 'passed',
  inconclusive: 'neutral',
};

const SEVERITY_TONE: Record<string, PillTone> = {
  critical: 'failed',
  high: 'failed',
  medium: 'error',
  low: 'neutral',
  none: 'neutral',
  unknown: 'neutral',
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-400',
  high: 'bg-red-400',
  medium: 'bg-orange-400',
  low: 'bg-neutral-500',
  none: 'bg-neutral-600',
  unknown: 'bg-neutral-600',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#64748b',
  none: '#475569',
  unknown: '#475569',
};

interface BugIntelligenceProps {
  /** Start an analysis on arrival (quick action / command palette). */
  analyzeOnMount?: boolean;
  onActionConsumed?: () => void;
  onNavigateToRuns?: () => void;
}


export function BugIntelligence({
  analyzeOnMount = false,
  onActionConsumed,
  onNavigateToRuns,
}: BugIntelligenceProps = {}): JSX.Element {
  const [clusters, setClusters] = useState<BugCluster[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState<AnalyzeSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<OverviewAiMetrics['aiMetrics'] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      const [clsRes, ovRes] = await Promise.all([
        fetch('/api/ai/bug-intelligence/clusters?page=1&limit=50'),
        fetch('/api/dashboard/overview').catch(() => null),
      ]);
      const body = (await clsRes.json()) as ListResponse;
      setClusters(body.items);
      if (ovRes && ovRes.ok) {
        const ov = (await ovRes.json()) as OverviewAiMetrics;
        setAiMeta(ov.aiMetrics ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const analyze = async (): Promise<void> => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/bug-intelligence/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as AnalyzeSummary;
      setSummary(body);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setAnalyzing(false);
    }
  };

  // Ref guard: StrictMode re-runs mount effects, and analysis is not idempotent-cheap.
  const autoAnalyzed = useRef(false);
  useEffect(() => {
    if (!analyzeOnMount || autoAnalyzed.current) return;
    autoAnalyzed.current = true;
    onActionConsumed?.();
    void analyze();
  }, [analyzeOnMount]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cl of clusters ?? []) c[cl.status] = (c[cl.status] ?? 0) + 1;
    return c;
  }, [clusters]);

  const selected = clusters?.find((c) => c.id === selectedId) ?? null;
  const loading = clusters === null && !error;

  const visible = (clusters ?? []).filter((c) => !statusFilter || c.status === statusFilter);
  const toggle = (st: string): void => setStatusFilter((cur) => (cur === st ? null : st));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="INTELLIGENCE COMMAND"
        title="Bug Intelligence"
        subtitle="AI-assisted failure investigation and root-cause clustering."
        icon={<IconBug size={22} />}
        guide={entryFor('bugs').guide}
        actions={
          <button type="button" onClick={analyze} disabled={analyzing} className="abh-btn abh-btn-primary">
            {analyzing ? <IconSpinner size={14} /> : <IconSparkles size={14} />}
            {analyzing ? 'Analyzing…' : 'Analyze failures'}
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="abh-card relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 overflow-hidden px-4 py-3">
        {analyzing && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-1/3"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--primary-soft), transparent)',
              animation: 'abhTravel 1.4s linear infinite',
            }}
          />
        )}
        <div role="group" aria-label="Filter by status" className="relative flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={statusFilter === null} onClick={() => setStatusFilter(null)} className="abh-chip">
            All <span className="tabular-nums text-[var(--text-subtle)]">{clusters?.length ?? 0}</span>
          </button>
          {(
            [
              ['open', 'Open', '#f59e0b'],
              ['regressed', 'Regressed', '#ef4444'],
              ['recurring', 'Recurring', '#f97316'],
              ['resolved', 'Resolved', '#10b981'],
              ['inconclusive', 'Inconclusive', '#64748b'],
            ] as const
          ).map(([key, label, color]) => (
            <button key={key} type="button" aria-pressed={statusFilter === key} onClick={() => toggle(key)} className="abh-chip">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {label}
              <span className="tabular-nums text-[var(--text-subtle)]">{counts[key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative flex items-center gap-2 text-xs text-[var(--text-subtle)]">
          <IconSparkles size={12} className={analyzing ? 'abh-spin-slow text-[var(--primary-strong)]' : 'text-[var(--primary-strong)]'} />
          {analyzing ? (
            <span className="text-[var(--primary-strong)]">Analyzing failures…</span>
          ) : (
            <span>
              {aiMeta?.provider ?? 'AI'}
              {aiMeta?.model ? <span className="font-mono"> · {aiMeta.model}</span> : null}
              {aiMeta?.requestCount !== undefined ? ` · ${aiMeta.requestCount} investigations` : ''}
            </span>
          )}
        </div>
      </div>

      {summary && (
        <p className="abh-fade-up text-xs text-[var(--text-subtle)]">
          Last analysis: {summary.analyzedRuns} runs · {summary.candidatePairs} candidate pairs ·{' '}
          {summary.aiComparisons} AI comparisons · {summary.clustersCreated} created · {summary.clustersUpdated} updated ·{' '}
          {summary.durationMs}ms
        </p>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="abh-skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : !clusters || clusters.length === 0 ? (
        <OrbitalEmptyState
          visualization="constellation"
          accent="violet"
          title="No bugs detected"
          subtitle="AI Bug Intelligence will surface recurring failures as your test history grows."
          steps={[
            'Run tests until some of them fail.',
            'Press Analyze failures to group related failures.',
            'Open a cluster to read its root cause and timeline.',
          ]}
          cta={{ label: 'Analyze Failures', onClick: analyze, icon: <IconSparkles size={14} /> }}
          {...(onNavigateToRuns
            ? { secondary: { label: 'View test runs', onClick: onNavigateToRuns, icon: <IconList size={14} /> } }
            : {})}
        />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
          No {statusFilter} clusters.{' '}
          <button type="button" className="text-[var(--primary-strong)] hover:underline" onClick={() => setStatusFilter(null)}>
            Show all
          </button>
        </div>
      ) : (
        <div className="abh-stagger grid gap-3 md:grid-cols-2">
          {visible.map((c) => (
            <ClusterCard key={c.id} c={c} onOpen={() => setSelectedId(c.id)} />
          ))}
        </div>
      )}

      {selected && <ClusterModal cluster={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 truncate text-[var(--text)]">{value}</dd>
    </div>
  );
}

function ClusterCard({ c, onOpen }: { c: BugCluster; onOpen: () => void }): JSX.Element {
  const sevTone = SEVERITY_TONE[c.severity] ?? 'neutral';
  const statTone = STATUS_TONE[c.status] ?? 'neutral';
  const color = SEVERITY_COLOR[c.severity] ?? '#475569';
  const spot = useSpotlight();
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseMove={spot}
      className="abh-card abh-spot abh-lift group flex w-full flex-col p-4 pl-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
    >
      <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[c.severity] ?? 'bg-neutral-600'}`}
          />
          <div className="truncate text-sm font-medium text-[var(--text)]">{c.title}</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <StatusPill tone={sevTone}>{c.severity}</StatusPill>
          <StatusPill tone={statTone}>{c.status}</StatusPill>
        </div>
      </div>
      {c.rootCauseSummary && (
        <p className="relative mt-2 line-clamp-2 text-xs text-[var(--text-muted)]">{c.rootCauseSummary}</p>
      )}
      <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-subtle)]">
        <span><span className="font-medium tabular-nums text-[var(--text)]">{c.occurrenceCount}</span> occurrences</span>
        <span><span className="font-medium tabular-nums text-[var(--text)]">{c.affectedTestCount}</span> tests</span>
        <span><span className="font-medium tabular-nums text-[var(--text)]">{Math.round(c.confidence * 100)}%</span> confidence</span>
      </div>
      <MiniTimeline first={c.firstSeenAt} last={c.lastSeenAt} count={c.occurrenceCount} />
      <div className="relative mt-3 flex items-center justify-between text-xs text-[var(--text-subtle)] group-hover:text-violet-300">
        <span>View investigation</span>
        <IconExternalLink size={12} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </button>
  );
}

function MiniTimeline({
  first,
  last,
  count,
}: {
  first: string;
  last: string;
  count: number;
}): JSX.Element {
  const ticks = Math.max(0, Math.min(count - 2, 6));
  return (
    <div className="mt-3">
      <div className="relative h-6">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-violet-500/30 via-white/10 to-cyan-500/30" />
        <span className="absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-violet-400" />
        {Array.from({ length: ticks }).map((_, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-neutral-500"
            style={{ left: `${((i + 1) / (ticks + 1)) * 100}%` }}
          />
        ))}
        <span className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-cyan-400" />
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-[var(--text-subtle)]">
        <span>{formatRelativeTime(first)}</span>
        <span>{formatRelativeTime(last)}</span>
      </div>
    </div>
  );
}

interface DetailResponse {
  cluster: BugCluster;
  members: Array<{
    testRunId: string;
    similarityScore: number;
    membershipReason: Array<{ name: string; contribution: number; explanation: string }>;
    run: {
      id: string;
      externalTestId: string;
      testName: string;
      status: string;
      startedAt: string;
      durationMs: number;
    } | null;
  }>;
  timeline: Array<{
    at: string;
    testRunId: string;
    externalTestId: string;
    status: string;
    kind: string;
  }>;
}

function ClusterModal({
  cluster,
  onClose,
}: {
  cluster: BugCluster;
  onClose: () => void;
}): JSX.Element {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setErr(null);
    fetch(`/api/ai/bug-intelligence/clusters/${cluster.id}`)
      .then((r) => r.json())
      .then((body: DetailResponse) => setData(body))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'unknown'));
  }, [cluster.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cluster ${cluster.title}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-8 w-full max-w-3xl rounded-2xl border border-violet-500/25 bg-[var(--surface-elevated)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-violet-300">
              CLUSTER INVESTIGATION
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-[var(--text)]">{cluster.title}</h2>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--text-subtle)] tabular-nums">
              {cluster.occurrenceCount} OCCURRENCES · {cluster.affectedTestCount} TESTS ·{' '}
              {Math.round(cluster.confidence * 100)}% CONFIDENCE
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            aria-label="Close"
          >
            <IconXMark size={16} />
          </button>
        </div>

        {err && <div className="mt-4 text-sm text-red-300">{err}</div>}

        <div className="mt-5 space-y-5 text-sm">
          <section>
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-subtle)]">
              AI CLASSIFICATION
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MetaCell label="Severity" value={cluster.severity} />
              <MetaCell label="Status" value={cluster.status} />
              <MetaCell label="Regression" value={cluster.regressionStatus} />
            </div>
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-subtle)]">
                Confidence
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                <div
                  className="abh-grow-x h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  style={{ width: `${Math.round(cluster.confidence * 100)}%` }}
                />
              </div>
            </div>
          </section>

          {cluster.primaryFailureSignature && (
            <section>
              <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                FAILURE SIGNATURE
              </div>
              <div className="mt-2 break-all rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-xs text-[var(--text-muted)]">
                {cluster.primaryFailureSignature}
              </div>
            </section>
          )}

          {cluster.rootCauseSummary && (
            <section>
              <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                ROOT CAUSE (PRIMARY INVESTIGATION)
              </div>
              <div className="mt-2 text-[var(--text)]">{cluster.rootCauseSummary}</div>
            </section>
          )}

          {data && data.members.length > 0 && (
            <section>
              <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                MEMBERS ({data.members.length})
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {data.members.map((m) => (
                  <li
                    key={m.testRunId}
                    className="flex items-center justify-between border-b border-[var(--border)] py-1.5"
                  >
                    <span className="truncate text-[var(--text-muted)]">
                      {m.run?.testName ?? m.testRunId}
                      {m.run && <span className="ml-2 text-[var(--text-subtle)]">· {m.run.status}</span>}
                    </span>
                    <span className="tabular-nums text-[var(--text-subtle)]">
                      {Math.round(m.similarityScore * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data && data.timeline.length > 0 && (
            <section>
              <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                TIMELINE
              </div>
              <ol className="mt-2 space-y-0.5 text-xs text-[var(--text-muted)]">
                {data.timeline.map((t, i) => (
                  <li key={`${t.testRunId}-${i}`} className="flex gap-3">
                    <span className="tabular-nums text-[var(--text-subtle)]">
                      {new Date(t.at).toLocaleString()}
                    </span>
                    <span>
                      → {t.kind} · <span className="text-[var(--text-muted)]">{t.status}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
