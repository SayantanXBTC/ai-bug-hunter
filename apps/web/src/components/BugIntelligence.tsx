import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from './shared/PageHeader.js';
import { MetricPanel } from './shared/MetricPanel.js';
import { StatusPill, type PillTone } from './shared/StatusPill.js';
import { IconSparkles, IconSpinner, IconXMark, IconExternalLink } from './icons.js';
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

export function BugIntelligence(): JSX.Element {
  const [clusters, setClusters] = useState<BugCluster[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState<AnalyzeSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<OverviewAiMetrics['aiMetrics'] | null>(null);

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

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cl of clusters ?? []) c[cl.status] = (c[cl.status] ?? 0) + 1;
    return c;
  }, [clusters]);

  const selected = clusters?.find((c) => c.id === selectedId) ?? null;
  const loading = clusters === null && !error;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="INTELLIGENCE COMMAND"
        title="Bug Intelligence"
        subtitle="AI-assisted failure investigation and root-cause clustering."
        actions={
          <button
            type="button"
            onClick={analyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-60"
          >
            {analyzing ? <IconSpinner size={14} /> : <IconSparkles size={14} />}
            {analyzing ? 'Analyzing…' : 'Analyze failures'}
          </button>
        }
      />

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {summary && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Analyzed {summary.analyzedRuns} runs · {summary.candidatePairs} candidate pairs ·{' '}
          {summary.deterministicStrongPairs} deterministic strong · {summary.aiComparisons} AI comparisons ·{' '}
          {summary.clustersCreated} created · {summary.clustersUpdated} updated · {summary.durationMs}ms
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricPanel index={0} label="Open" value={counts.open ?? 0} accent="orange" />
        <MetricPanel index={1} label="Regressed" value={counts.regressed ?? 0} accent="red" />
        <MetricPanel index={2} label="Recurring" value={counts.recurring ?? 0} accent="orange" />
        <MetricPanel index={3} label="Resolved" value={counts.resolved ?? 0} accent="emerald" />
        <MetricPanel index={4} label="Inconclusive" value={counts.inconclusive ?? 0} accent="neutral" />
      </div>

      <div className="rounded-xl border border-violet-500/25 bg-[var(--surface-glass)] p-4 backdrop-blur-md">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-violet-300">
          <IconSparkles size={12} /> AI INVESTIGATION ENGINE
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <MetaCell label="Provider" value={aiMeta?.provider ?? '—'} />
          <MetaCell label="Model" value={aiMeta?.model ?? '—'} />
          <MetaCell
            label="Investigations"
            value={aiMeta?.requestCount !== undefined ? String(aiMeta.requestCount) : '—'}
          />
          <MetaCell
            label="Clusters Analyzed"
            value={clusters ? String(clusters.length) : '—'}
          />
        </dl>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
          ))}
        </div>
      ) : !clusters || clusters.length === 0 ? (
        <OrbitalEmptyState
          visualization="constellation"
          accent="violet"
          title="No bugs detected"
          subtitle="AI Bug Intelligence will surface recurring failures as your test history grows."
          cta={{ label: 'Analyze Failures', onClick: analyze, icon: <IconSparkles size={14} /> }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {clusters.map((c) => (
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
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] p-4 text-left backdrop-blur-md transition-colors hover:border-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
    >
      <div className="flex items-start justify-between gap-3">
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
      <div className="mt-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--text-subtle)] tabular-nums">
        {c.occurrenceCount} OCCURRENCES · {c.affectedTestCount} TESTS · {c.affectedPageCount} PAGE
        {c.affectedPageCount === 1 ? '' : 'S'} · {Math.round(c.confidence * 100)}% CONF
      </div>
      <MiniTimeline first={c.firstSeenAt} last={c.lastSeenAt} count={c.occurrenceCount} />
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-subtle)] group-hover:text-violet-300">
        <span>View investigation</span>
        <IconExternalLink size={12} />
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
        className="mt-8 w-full max-w-3xl rounded-xl border border-violet-500/25 bg-[var(--surface)] p-6 shadow-2xl"
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
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
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
