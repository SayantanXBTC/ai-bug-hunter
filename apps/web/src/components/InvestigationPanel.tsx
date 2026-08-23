import { useEffect, useState } from 'react';

interface ObservedFact {
  id: string;
  type: string;
  description: string;
  source: string;
}
interface Hypothesis {
  id: string;
  statement: string;
  confidence: number;
  reasoningSummary: string;
  observedFactIds: string[];
  evidenceIds: string[];
}
interface EvidenceRef {
  evidenceId: string;
  evidenceType: string;
  description: string;
}
interface ReproductionStep {
  order: number;
  stepIndex: number;
  action: string;
  description: string;
}
interface InvestigationReport {
  id: string;
  testRunId: string;
  classification: string;
  severity: string;
  confidence: number;
  summary: string;
  likelyRootCause: string | null;
  affectedArea: string | null;
  observedFacts: ObservedFact[];
  hypotheses: Hypothesis[];
  supportingEvidence: EvidenceRef[];
  reproductionSteps: ReproductionStep[];
  recommendedNextSteps: string[];
  validationWarnings: string[];
  generatedAt: string;
  provider: string;
  model: string;
  durationMs: number;
}

interface Response {
  status: 'ok' | 'not_investigable' | 'provider_error' | 'validation_error';
  report?: InvestigationReport;
  message?: string;
  cached?: boolean;
}

interface Props {
  testRunId: string;
  runStatus: string;
}

const CLASSIFICATION_LABEL: Record<string, string> = {
  application_defect: 'Application defect',
  test_defect: 'Test defect',
  environment_failure: 'Environment failure',
  dependency_failure: 'Dependency failure',
  data_failure: 'Data failure',
  inconclusive: 'Inconclusive',
};
const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-rose-400',
  high: 'text-rose-300',
  medium: 'text-amber-300',
  low: 'text-slate-300',
  none: 'text-slate-500',
};

export function InvestigationPanel({ testRunId, runStatus }: Props): JSX.Element | null {
  const [state, setState] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(null);
    setError(null);
    if (runStatus === 'passed') return;
    // Try to fetch existing investigation.
    fetch(`/api/ai/investigate/${testRunId}`)
      .then((r) => (r.status === 404 ? null : r.json()))
      .then((body: Response | null) => {
        if (body) setState(body);
      })
      .catch(() => undefined);
  }, [testRunId, runStatus]);

  if (runStatus === 'passed') return null;

  const run = async (force: boolean): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ai/investigate/${testRunId}${force ? '?force=true' : ''}`,
        { method: 'POST' },
      );
      const body = (await res.json()) as Response;
      setState(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-slate-200">AI Failure Investigation</h4>
        <div className="flex gap-2">
          <button
            onClick={() => run(false)}
            disabled={loading}
            className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {loading ? 'Investigating…' : state?.report ? 'View investigation' : 'Investigate Failure'}
          </button>
          {state?.report && (
            <button
              onClick={() => run(true)}
              disabled={loading}
              className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Regenerate
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-xs text-rose-400">{error}</div>}

      {state && state.status !== 'ok' && (
        <div className="rounded border border-amber-900 bg-amber-950/40 p-2 text-xs text-amber-200">
          <div className="uppercase tracking-wider">{state.status}</div>
          {state.message && <div className="mt-1">{state.message}</div>}
        </div>
      )}

      {state?.report && <ReportBody report={state.report} cached={state.cached} />}
    </div>
  );
}

function ReportBody({
  report,
  cached,
}: {
  report: InvestigationReport;
  cached?: boolean;
}): JSX.Element {
  const pct = Math.round(report.confidence * 100);
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <MetaBox label="Classification" value={CLASSIFICATION_LABEL[report.classification] ?? report.classification} />
        <MetaBox
          label="Severity"
          value={report.severity}
          valueClass={SEVERITY_COLOR[report.severity] ?? 'text-slate-300'}
        />
        <MetaBox label="Confidence" value={`${pct}%`} />
        <MetaBox label="Provider" value={`${report.provider} / ${report.model}`} />
      </div>
      {cached && (
        <div className="text-xs text-slate-500">Cached — click Regenerate for a fresh run.</div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500">Summary</div>
        <div className="text-slate-100">{report.summary}</div>
      </div>

      {report.likelyRootCause && (
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Likely root cause (confidence {pct}%)
          </div>
          <div className="text-slate-100">{report.likelyRootCause}</div>
        </div>
      )}

      {report.affectedArea && (
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">Affected area</div>
          <div className="text-slate-300">{report.affectedArea}</div>
        </div>
      )}

      <Section title={`Observed facts (${report.observedFacts.length})`}>
        <ul className="text-xs text-slate-300 space-y-1">
          {report.observedFacts.map((f) => (
            <li key={f.id}>
              <span className="text-slate-500 uppercase mr-1">{f.type}</span>
              {f.description}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Hypotheses (${report.hypotheses.length})`}>
        <ul className="text-xs text-slate-300 space-y-2">
          {report.hypotheses.map((h) => (
            <li key={h.id} className="border-l-2 border-slate-700 pl-2">
              <div className="text-slate-100">{h.statement}</div>
              <div className="text-slate-500 mt-0.5">
                confidence {Math.round(h.confidence * 100)}% · evidence:{' '}
                {h.evidenceIds.join(', ') || 'none'}
              </div>
              <div className="text-slate-400 mt-0.5">{h.reasoningSummary}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Supporting evidence (${report.supportingEvidence.length})`}>
        <ul className="text-xs text-slate-300 space-y-1">
          {report.supportingEvidence.map((s) => (
            <li key={s.evidenceId}>
              <a
                href={`/api/evidence/${s.evidenceId}`}
                target="_blank"
                rel="noreferrer"
                className="text-brand-500 hover:underline"
              >
                {s.evidenceType}
              </a>
              {s.description && <span> — {s.description}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Reproduction steps (${report.reproductionSteps.length})`}>
        <ol className="text-xs text-slate-300 list-decimal list-inside">
          {report.reproductionSteps.map((s) => (
            <li key={s.order}>
              step {s.stepIndex}: {s.action}
            </li>
          ))}
        </ol>
      </Section>

      <Section title={`Recommended next steps (${report.recommendedNextSteps.length})`}>
        <ul className="text-xs text-slate-300 list-disc list-inside">
          {report.recommendedNextSteps.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Section>

      {report.validationWarnings.length > 0 && (
        <div className="text-xs text-amber-400">
          {report.validationWarnings.length} validation warning(s) — some LLM references were rejected.
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{title}</div>
      {children}
    </div>
  );
}

function MetaBox({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}): JSX.Element {
  return (
    <div className="border border-slate-800 rounded px-2 py-1">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={valueClass ?? 'text-slate-100'}>{value}</div>
    </div>
  );
}
