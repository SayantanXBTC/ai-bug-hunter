import { useEffect, useState } from 'react';

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

const STATUS_ICON: Record<string, string> = {
  open: '🟡',
  recurring: '🟠',
  regressed: '🔴',
  resolved: '🟢',
  inconclusive: '⚪',
};

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'text-rose-400',
  high: 'text-rose-300',
  medium: 'text-amber-300',
  low: 'text-slate-300',
  none: 'text-slate-500',
  unknown: 'text-slate-500',
};

export function BugIntelligence(): JSX.Element {
  const [clusters, setClusters] = useState<BugCluster[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState<AnalyzeSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      const res = await fetch('/api/ai/bug-intelligence/clusters?page=1&limit=20');
      const body = (await res.json()) as ListResponse;
      setClusters(body.items);
      setTotal(body.total);
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

  const counts = countByStatus(clusters ?? []);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold">Bug Intelligence</h2>
          <p className="mt-1 text-sm text-slate-400">
            Cross-run failure clustering — deterministic fingerprints first, AI only for ambiguous
            pairs.
          </p>
        </div>
        <button
          onClick={analyze}
          disabled={analyzing}
          className="rounded bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {analyzing ? 'Analyzing…' : 'Analyze failures'}
        </button>
      </div>

      {error && <div className="text-sm text-rose-400">{error}</div>}

      {summary && (
        <div className="text-xs text-slate-400">
          Analyzed {summary.analyzedRuns} runs · {summary.candidatePairs} candidate pairs ·{' '}
          {summary.deterministicStrongPairs} deterministic strong matches · {summary.aiComparisons}{' '}
          AI comparisons · {summary.clustersCreated} created · {summary.clustersUpdated} updated ·{' '}
          {summary.durationMs} ms
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <CountBox label="Open" value={counts.open ?? 0} />
        <CountBox label="Regressed" value={counts.regressed ?? 0} />
        <CountBox label="Recurring" value={counts.recurring ?? 0} />
        <CountBox label="Resolved" value={counts.resolved ?? 0} />
        <CountBox label="Inconclusive" value={counts.inconclusive ?? 0} />
      </div>

      {clusters === null ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : clusters.length === 0 ? (
        <div className="text-sm text-slate-500">
          No bug clusters yet. Run analysis on failed test runs to generate clusters.
        </div>
      ) : (
        <>
          <div className="text-xs text-slate-500">{total} cluster(s)</div>
          <div className="space-y-2">
            {clusters.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id === selected ? null : c.id)}
                className={`w-full text-left border rounded p-3 ${
                  selected === c.id ? 'border-brand-500 bg-slate-900' : 'border-slate-800 hover:bg-slate-900/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span>{STATUS_ICON[c.status] ?? '⚪'}</span>
                    <span className="text-slate-100 font-medium">{c.title}</span>
                  </div>
                  <span className={`text-xs ${SEVERITY_CLASS[c.severity] ?? 'text-slate-300'}`}>
                    {c.severity} · {c.status} · {Math.round(c.confidence * 100)}%
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {c.occurrenceCount} occurrence(s) · {c.affectedTestCount} test(s) ·{' '}
                  {c.affectedPageCount} page(s) · first seen{' '}
                  {new Date(c.firstSeenAt).toLocaleString()} · last seen{' '}
                  {new Date(c.lastSeenAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
          {selected && <ClusterDetail id={selected} />}
        </>
      )}
    </div>
  );
}

function countByStatus(items: BugCluster[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of items) out[c.status] = (out[c.status] ?? 0) + 1;
  return out;
}

function CountBox({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="border border-slate-800 rounded px-2 py-1">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-100">{value}</div>
    </div>
  );
}

interface DetailResponse {
  cluster: BugCluster;
  members: Array<{
    testRunId: string;
    similarityScore: number;
    membershipReason: Array<{ name: string; contribution: number; explanation: string }>;
    run: { id: string; externalTestId: string; testName: string; status: string; startedAt: string; durationMs: number } | null;
  }>;
  timeline: Array<{ at: string; testRunId: string; externalTestId: string; status: string; kind: string }>;
}

function ClusterDetail({ id }: { id: string }): JSX.Element {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/ai/bug-intelligence/clusters/${id}`)
      .then((r) => r.json())
      .then((body: DetailResponse) => setData(body))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'unknown'));
  }, [id]);

  if (error) return <div className="text-xs text-rose-400 mt-2">{error}</div>;
  if (!data) return <div className="text-xs text-slate-400 mt-2">Loading detail…</div>;

  return (
    <div className="mt-3 rounded border border-brand-500/40 p-3 space-y-3 text-sm bg-slate-900/40">
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500">Signature</div>
        <div className="text-slate-100 break-all">{data.cluster.primaryFailureSignature}</div>
      </div>
      {data.cluster.rootCauseSummary && (
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">Root cause (from primary investigation)</div>
          <div className="text-slate-100">{data.cluster.rootCauseSummary}</div>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500">Members ({data.members.length})</div>
        <ul className="text-xs space-y-1">
          {data.members.map((m) => (
            <li key={m.testRunId} className="border-b border-slate-800 py-1">
              <div className="flex justify-between text-slate-300">
                <span>
                  {m.run?.testName ?? m.testRunId}
                  <span className="text-slate-500"> · {m.run?.status ?? ''}</span>
                </span>
                <span className="text-slate-500">{Math.round(m.similarityScore * 100)}%</span>
              </div>
              <div className="text-slate-500">
                {m.membershipReason.map((r) => r.name).join(', ')}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500">Timeline</div>
        <ol className="text-xs text-slate-400 space-y-0.5">
          {data.timeline.map((t) => (
            <li key={t.testRunId}>
              {new Date(t.at).toLocaleString()} — {t.kind} · {t.status}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
