import { useTestRun, type EvidenceDetail, type StepDetail } from '../hooks/useTestRuns.js';
import { InvestigationPanel } from './InvestigationPanel.js';
import { StatusPill, type PillTone } from './shared/StatusPill.js';
import {
  IconArrowLeft,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconFileText,
  IconExternalLink,
  IconEye,
  IconCodeBrackets,
  IconNetwork,
  IconGlobe,
  IconList,
} from './icons.js';
import { formatDuration, formatRelativeTime } from '../lib/format.js';

interface Props {
  id: string;
  onClose: () => void;
}

const STATUS_TONE: Record<string, PillTone> = {
  passed: 'passed',
  failed: 'failed',
  error: 'error',
  running: 'running',
  skipped: 'skipped',
};

const ACTION_LABEL: Record<string, string> = {
  navigate: 'Navigate',
  click: 'Click',
  fill: 'Fill',
  type: 'Type',
  press: 'Press',
  wait: 'Wait',
  assert: 'Assert',
  screenshot: 'Screenshot',
  select: 'Select',
};

function labelFor(action: string): string {
  return ACTION_LABEL[action.toLowerCase()] ?? action;
}

const EVIDENCE_ICON: Record<string, JSX.Element> = {
  screenshot: <IconEye size={14} />,
  dom: <IconCodeBrackets size={14} />,
  console: <IconList size={14} />,
  page_error: <IconAlertTriangle size={14} />,
  network: <IconNetwork size={14} />,
  browser_metadata: <IconGlobe size={14} />,
};

export function TestRunDetail({ id, onClose }: Props): JSX.Element {
  const { data, error } = useTestRun(id);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
        Failed to load run: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[rgba(12,14,22,0.65)] p-6 text-sm text-neutral-400">
        Loading execution trace…
      </div>
    );
  }

  const tone: PillTone = STATUS_TONE[data.status] ?? 'neutral';
  const isFailed = data.status === 'failed' || data.status === 'error';

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-violet-500/40 rounded"
      >
        <IconArrowLeft size={14} /> Back to runs
      </button>

      <div className="rounded-xl border border-white/[0.06] bg-[rgba(12,14,22,0.65)] p-5 backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
              EXECUTION TRACE
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white/90 truncate">{data.testName}</h2>
            <div
              className="mt-1 font-mono text-[11px] text-neutral-500 truncate hover:text-neutral-300"
              title={data.id}
            >
              {data.id}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={tone}>{data.status}</StatusPill>
            <span className="rounded-md border border-white/[0.06] bg-black/30 px-2 py-1 text-xs tabular-nums text-neutral-300">
              {formatDuration(data.durationMs)}
            </span>
            <span className="rounded-md border border-white/[0.06] bg-black/30 px-2 py-1 text-xs text-neutral-400">
              {formatRelativeTime(data.startedAt)}
            </span>
          </div>
        </div>
      </div>

      {isFailed && data.error?.message && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.04] p-4">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-red-300">
            <IconAlertTriangle size={12} /> FAILURE DETECTED
          </div>
          <div className="mt-2 text-sm font-semibold text-red-200">
            {data.error.name ?? 'Error'}
          </div>
          <div className="mt-1 whitespace-pre-wrap text-xs text-red-200/80">
            {data.error.message}
          </div>
          {data.error.stepIndex !== null && data.error.stepIndex !== undefined && (
            <div className="mt-2 text-xs text-red-300/80">
              Failing step: <span className="font-mono">#{data.error.stepIndex}</span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-[rgba(12,14,22,0.65)] p-5 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
            EXECUTION TRACE
          </div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
            {data.steps.length} STEP{data.steps.length === 1 ? '' : 'S'}
          </div>
        </div>
        {data.steps.length === 0 ? (
          <div className="text-sm text-neutral-500">— No steps recorded</div>
        ) : (
          <ol className="space-y-1">
            {data.steps.map((s) => (
              <StepRow key={s.index} step={s} failingIndex={data.error?.stepIndex ?? null} />
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[rgba(12,14,22,0.65)] p-5 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
            EVIDENCE
          </div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
            {data.evidence.length} ARTIFACT{data.evidence.length === 1 ? '' : 'S'}
          </div>
        </div>
        {data.evidence.length === 0 ? (
          <div className="text-sm text-neutral-500">— No evidence captured</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {data.evidence.map((e) => (
              <EvidenceCard key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>

      <InvestigationPanel testRunId={data.id} runStatus={data.status} />
    </div>
  );
}

function StepRow({
  step,
  failingIndex,
}: {
  step: StepDetail;
  failingIndex: number | null;
}): JSX.Element {
  const isFailing = failingIndex !== null && failingIndex === step.index;
  const glyph =
    step.status === 'passed' ? (
      <IconCheck size={12} className="text-emerald-400" />
    ) : step.status === 'failed' ? (
      <IconX size={12} className="text-red-400" />
    ) : (
      <span className="text-neutral-600">—</span>
    );

  const meta = (step as StepDetail & { target?: string; url?: string; selector?: string });
  const target = meta.target ?? meta.url ?? meta.selector ?? null;

  return (
    <li
      className={`rounded-md border px-3 py-2 transition-colors ${
        isFailing
          ? 'border-red-500/25 bg-red-500/[0.05]'
          : 'border-white/[0.04] bg-black/20 hover:border-white/[0.08]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-neutral-400">
          {String(step.index).padStart(2, '0')}
        </span>
        <span className="w-4 shrink-0 text-center">{glyph}</span>
        <span className="text-sm font-medium text-white/90">{labelFor(step.action)}</span>
        {target && (
          <span className="truncate font-mono text-[11px] text-neutral-500" title={target}>
            {target}
          </span>
        )}
        <span className="ml-auto tabular-nums text-[11px] text-neutral-500">
          {formatDuration(step.durationMs)}
        </span>
      </div>
      {isFailing && step.error?.message && (
        <div className="mt-2 rounded border border-red-500/20 bg-black/30 p-2 text-xs text-red-200/90">
          <span className="font-mono">{step.error.name ?? 'Error'}:</span> {step.error.message}
        </div>
      )}
    </li>
  );
}

function EvidenceCard({ e }: { e: EvidenceDetail }): JSX.Element {
  const href = e.downloadUrl ?? `/api/evidence/${e.id}`;
  const icon = EVIDENCE_ICON[e.type] ?? <IconFileText size={14} />;
  const isImage = e.type === 'screenshot';
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-black/30 transition-colors hover:border-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
    >
      {isImage && (
        <div className="aspect-video overflow-hidden bg-black/50">
          <img
            src={href}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            onError={(ev) => {
              (ev.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-neutral-400">{icon}</span>
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 truncate">
              {e.type.replace(/_/g, ' ')}
            </div>
            <div className="text-[11px] tabular-nums text-neutral-500">
              {e.byteSize ? `${(e.byteSize / 1024).toFixed(1)} KB` : '—'}
            </div>
          </div>
        </div>
        <span className="text-neutral-500 group-hover:text-violet-300">
          <IconExternalLink size={12} />
        </span>
      </div>
    </a>
  );
}
