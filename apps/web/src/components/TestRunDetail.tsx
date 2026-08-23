import { useTestRun } from '../hooks/useTestRuns.js';
import { InvestigationPanel } from './InvestigationPanel.js';

interface Props {
  id: string;
  onClose: () => void;
}

export function TestRunDetail({ id, onClose }: Props): JSX.Element {
  const { data, error } = useTestRun(id);

  if (error) return <div className="text-rose-400 text-sm">Failed to load: {error}</div>;
  if (!data) return <div className="text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">{data.testName}</h3>
          <p className="text-xs text-slate-500">{data.id}</p>
        </div>
        <button
          onClick={onClose}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <Stat label="Status" value={data.status} />
        <Stat label="Duration" value={`${data.durationMs} ms`} />
        <Stat label="Started" value={new Date(data.startedAt).toLocaleString()} />
      </div>

      {data.error?.message && (
        <div className="rounded border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-200">
          <div className="font-medium">{data.error.name ?? 'Error'}</div>
          <div className="text-xs mt-1 text-rose-300">{data.error.message}</div>
          {data.error.stepIndex !== null && (
            <div className="text-xs mt-1 text-rose-400">Failing step: {data.error.stepIndex}</div>
          )}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Steps</h4>
        <div className="space-y-1 text-sm">
          {data.steps.map((s) => (
            <div key={s.index} className="flex justify-between border-b border-slate-800 py-1">
              <span className="text-slate-300">
                #{s.index} {s.action}
              </span>
              <span
                className={
                  s.status === 'passed'
                    ? 'text-emerald-400'
                    : s.status === 'failed'
                      ? 'text-rose-400'
                      : 'text-slate-500'
                }
              >
                {s.status} · {s.durationMs} ms
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Evidence</h4>
        {data.evidence.length === 0 ? (
          <div className="text-xs text-slate-500">No evidence captured.</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.evidence.map((e) => (
              <li key={e.id} className="border-b border-slate-800 py-1">
                <span className="text-slate-300">{e.type}</span>
                {e.downloadUrl && (
                  <>
                    {' · '}
                    <a
                      href={e.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-500 hover:underline"
                    >
                      download ({e.byteSize ?? '?'} bytes)
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <InvestigationPanel testRunId={data.id} runStatus={data.status} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-100">{value}</div>
    </div>
  );
}
