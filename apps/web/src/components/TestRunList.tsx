import { useTestRuns, type TestRunSummary } from '../hooks/useTestRuns.js';
import { EmptyState } from './EmptyState.js';

interface Props {
  onSelect: (id: string) => void;
}

const STATUS_CLASS: Record<TestRunSummary['status'], string> = {
  passed: 'text-emerald-400',
  failed: 'text-rose-400',
  error: 'text-amber-400',
};

export function TestRunList({ onSelect }: Props): JSX.Element {
  const { data, error, refresh } = useTestRuns();

  if (error) {
    return <div className="text-sm text-rose-400">Failed to load test runs: {error}</div>;
  }
  if (!data) {
    return <div className="text-sm text-slate-400">Loading…</div>;
  }
  if (data.items.length === 0) {
    return <EmptyState text="No test runs yet." />;
  }

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-2">
        <span>
          {data.total} total, page {data.page} / {Math.max(1, Math.ceil(data.total / data.limit))}
        </span>
        <button
          onClick={refresh}
          className="rounded border border-slate-700 px-2 py-0.5 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      <table className="w-full text-sm border border-slate-800">
        <thead className="bg-slate-900 text-slate-400 text-left">
          <tr>
            <th className="px-3 py-2">Test</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Duration</th>
            <th className="px-3 py-2">Started</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r.id)}
              className="cursor-pointer border-t border-slate-800 hover:bg-slate-900/50"
            >
              <td className="px-3 py-2 text-slate-100">{r.testName}</td>
              <td className={`px-3 py-2 font-medium ${STATUS_CLASS[r.status]}`}>{r.status}</td>
              <td className="px-3 py-2 text-slate-300">{r.durationMs} ms</td>
              <td className="px-3 py-2 text-slate-400">
                {new Date(r.startedAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
