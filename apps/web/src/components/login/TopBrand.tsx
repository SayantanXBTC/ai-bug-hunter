import { IconHexLogo } from '../icons.js';

export function TopBrand(): JSX.Element {
  return (
    <div className="pointer-events-none absolute left-6 top-6 z-20 flex items-center gap-3">
      <div
        className="text-violet-400"
        style={{ filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.55))' }}
      >
        <IconHexLogo size={40} />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white sm:text-base">
          <span className="text-violet-400">AI</span> <span>BUG HUNTER</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
          v0.10 · Autonomous QA
        </div>
      </div>
    </div>
  );
}
