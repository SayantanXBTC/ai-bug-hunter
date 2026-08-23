import { useEffect, useState } from 'react';

interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  trigger: string;
  selection_strategy: string;
  selected_test_count: number;
  passed_runs: number;
  failed_runs: number;
  error_runs: number;
  quality: string | null;
  created_at: string;
  finished_at: string | null;
}

interface CampaignDetail {
  campaign: CampaignSummary;
  members: Array<{
    testCaseId: string;
    testCaseName: string;
    priority: string;
    selectionScore: number;
    selectionReason: Array<{ name: string; contribution: number; explanation: string }>;
    executionRunId: string | null;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    ordinal: number;
  }>;
}

const QUALITY_CLASS: Record<string, string> = {
  healthy: 'text-emerald-400',
  degraded: 'text-amber-400',
  failed: 'text-rose-400',
  inconclusive: 'text-slate-400',
};

export function RegressionCampaigns(): JSX.Element {
  const [items, setItems] = useState<CampaignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState('risk_based');
  const [maxTests, setMaxTests] = useState(10);
  const [applicationId, setApplicationId] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);

  const load = async (): Promise<void> => {
    try {
      const res = await fetch('/api/regression-campaigns?page=1&limit=25');
      const body = await res.json();
      setItems(body.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setDetail(null);
    if (!selected) return;
    fetch(`/api/regression-campaigns/${selected}`)
      .then((r) => r.json())
      .then((body: CampaignDetail) => setDetail(body))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'unknown'));
  }, [selected]);

  const create = async (): Promise<void> => {
    setError(null);
    try {
      const res = await fetch('/api/regression-campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          strategy,
          maxTests,
          ...(applicationId ? { applicationId } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    }
  };

  const run = async (id: string): Promise<void> => {
    setRunning(id);
    try {
      await fetch(`/api/regression-campaigns/${id}/run`, { method: 'POST' });
      await load();
      if (selected === id) {
        const body = await (await fetch(`/api/regression-campaigns/${id}`)).json();
        setDetail(body);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setRunning(null);
    }
  };

  const cancel = async (id: string): Promise<void> => {
    await fetch(`/api/regression-campaigns/${id}/cancel`, { method: 'POST' });
    await load();
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Regression Campaigns</h2>
        <p className="mt-1 text-sm text-slate-400">
          Create a campaign, review selected tests, then click Run to execute (human review boundary).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="text-xs text-slate-400 flex flex-col">
          Application ID (optional)
          <input
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
          />
        </label>
        <label className="text-xs text-slate-400 flex flex-col">
          Strategy
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
          >
            <option value="all_enabled">all_enabled</option>
            <option value="risk_based">risk_based</option>
            <option value="smoke">smoke</option>
          </select>
        </label>
        <label className="text-xs text-slate-400 flex flex-col">
          Max tests
          <input
            type="number"
            min={1}
            value={maxTests}
            onChange={(e) => setMaxTests(Number(e.target.value))}
            className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
          />
        </label>
        <button
          onClick={create}
          className="rounded bg-brand-600 self-end px-3 py-1 text-sm text-white hover:bg-brand-500"
        >
          Create campaign
        </button>
      </div>

      {error && <div className="text-sm text-rose-400">{error}</div>}

      {items === null ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-slate-500 text-sm">No campaigns yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="border border-slate-800 rounded p-3">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setSelected(c.id === selected ? null : c.id)}
                  className="text-left text-slate-100 font-medium"
                >
                  {c.name}
                </button>
                <div className="text-xs text-slate-400">
                  {c.status} · quality{' '}
                  <span className={QUALITY_CLASS[c.quality ?? 'inconclusive']}>
                    {c.quality ?? 'pending'}
                  </span>{' '}
                  · {c.selected_test_count} tests · {c.passed_runs}/{c.failed_runs}/{c.error_runs}
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {c.selection_strategy} · created {new Date(c.created_at).toLocaleString()}
              </div>
              <div className="mt-2 flex gap-2">
                {c.status === 'queued' && (
                  <button
                    onClick={() => run(c.id)}
                    disabled={running === c.id}
                    className="rounded bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {running === c.id ? 'Running…' : 'Run Campaign'}
                  </button>
                )}
                {c.status === 'running' && (
                  <button
                    onClick={() => cancel(c.id)}
                    className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                )}
              </div>
              {selected === c.id && detail && (
                <div className="mt-3 border-t border-slate-800 pt-2 text-xs">
                  <div className="uppercase tracking-wider text-slate-500 mb-1">Selected tests</div>
                  <ul className="space-y-1">
                    {detail.members.map((m) => (
                      <li key={m.testCaseId} className="border-b border-slate-800 py-1">
                        <div className="flex justify-between">
                          <span className="text-slate-300">
                            #{m.ordinal + 1} {m.testCaseName} ({m.priority})
                          </span>
                          <span className="text-slate-500">
                            {m.status} · risk {Math.round(m.selectionScore * 100)}%
                          </span>
                        </div>
                        <ul className="text-slate-500 mt-0.5">
                          {m.selectionReason.slice(0, 3).map((r, i) => (
                            <li key={i}>
                              {r.name}: {r.explanation}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
