import type { QualityScoreResult } from '@ai-bug-hunter/shared';

interface QualityScoreCardProps {
  quality: QualityScoreResult | null;
  insufficient?: boolean;
}

function toneFor(score: number): { label: string; ring: string; text: string } {
  if (score >= 80) return { label: 'Good', ring: 'stroke-emerald-500', text: 'text-emerald-700' };
  if (score >= 50) return { label: 'Fair', ring: 'stroke-amber-500', text: 'text-amber-700' };
  return { label: 'Needs attention', ring: 'stroke-red-500', text: 'text-red-700' };
}

export function QualityScoreCard({ quality, insufficient }: QualityScoreCardProps): JSX.Element {
  const hasData = quality && !insufficient && quality.sampleSize > 0;
  const score = quality?.score ?? 0;
  const tone = toneFor(score);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Quality Score
        </div>
        {hasData ? (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
            score >= 80
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : score >= 50
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {tone.label}
          </span>
        ) : (
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            No data yet
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-1 items-center gap-5">
        <div className="relative shrink-0">
          <svg
            width={140}
            height={140}
            viewBox="0 0 140 140"
            role="img"
            aria-label={hasData ? `Quality score ${score} of 100` : 'Quality score unavailable'}
          >
            <circle
              cx={70}
              cy={70}
              r={radius}
              className="stroke-neutral-100"
              strokeWidth={10}
              fill="none"
            />
            {hasData && (
              <circle
                cx={70}
                cy={70}
                r={radius}
                className={tone.ring}
                strokeWidth={10}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${dash} ${circumference}`}
                transform="rotate(-90 70 70)"
              />
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-4xl font-semibold tabular-nums ${hasData ? 'text-neutral-900' : 'text-neutral-400'}`}>
              {hasData ? score : 0}
            </div>
            <div className="text-xs text-neutral-400">/ 100</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {hasData ? (
            <>
              <div className="text-sm text-neutral-500">
                Based on {quality!.sampleSize} recent test run{quality!.sampleSize === 1 ? '' : 's'}.
              </div>
              {quality!.warning && (
                <div className="mt-2 text-xs text-amber-700">{quality!.warning}</div>
              )}
            </>
          ) : (
            <div className="text-sm text-neutral-500">
              Not enough historical data yet. Run your first test to begin measuring
              application quality.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
