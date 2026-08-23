import { useEffect, useState } from 'react';

interface Reliability {
  externalTestId: string;
  testName: string;
  totalRuns: number;
  passCount: number;
  failureCount: number;
  flakyScore: number;
  reliabilityScore: number;
  status: 'stable' | 'suspected_flaky' | 'flaky' | 'unstable' | 'insufficient_data';
  signals: Array<{ name: string; contribution: number; explanation: string }>;
  explanation: string;
  calculatedAt: string;
}

const STATUS_ICON: Record<string, string> = {
  stable: '🟢',
  suspected_flaky: '🟡',
  flaky: '🔴',
  unstable: '🟠',
  insufficient_data: '⚪',
};

export function TestReliability(): JSX.Element {
  const [items, setItems] = useState<Reliability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const load = async (): Promise<void> => {
    try {
      const res = await fetch('/api/ai/test-reliability?page=1&limit=25');
      const body = await res.json();
      setItems(body.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const recalc = async (): Promise<void> => {
    setRecalculating(true);
    setError(null);
    try {
      await fetch('/api/ai/test-reliability/recalculate', { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setRecalculating(false);
    }
  };

  const counts: Record<string, number> = {};
  for (const r of items ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold">Test Reliability</h2>
          <p className="mt-1 text-sm text-slate-400">
            Historical flakiness — deterministic scoring; stable-broken tests are not misclassified
            as flaky.
          </p>
        </div>
        <button
          onClick={recalc}
          disabled={recalculating}
          className="rounded bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {recalculating ? 'Recalculating…' : 'Recalculate'}
        </button>
      </div>

      {error && <div className="text-sm text-rose-400">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        {(['stable', 'suspected_flaky', 'flaky', 'unstable', 'insufficient_data'] as const).map((s) => (
          <div key={s} className="border border-slate-800 rounded px-2 py-1">
            <div className="text-xs uppercase tracking-wider text-slate-500">{s}</div>
            <div className="text-slate-100">{counts[s] ?? 0}</div>
          </div>
        ))}
      </div>

      {items === null ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-slate-500 text-sm">No reliability data yet. Run some tests and recalculate.</div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.externalTestId} className="border border-slate-800 rounded p-3">
              <div className="flex justify-between">
                <div className="flex items-center gap-2">
                  <span>{STATUS_ICON[r.status] ?? '⚪'}</span>
                  <span className="text-slate-100 font-medium">{r.testName}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {r.status} · flaky {Math.round(r.flakyScore * 100)}% · reliability{' '}
                  {Math.round(r.reliabilityScore * 100)}%
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {r.passCount} / {r.totalRuns} passed · {r.failureCount} failed
              </div>
              <div className="mt-1 text-xs text-slate-500">{r.explanation}</div>
              {r.signals.length > 0 && (
                <ul className="mt-1 text-xs text-slate-400 list-disc list-inside">
                  {r.signals.slice(0, 3).map((s, i) => (
                    <li key={i}>
                      {s.name} ({s.contribution >= 0 ? '+' : ''}
                      {s.contribution.toFixed(2)}) — {s.explanation}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
