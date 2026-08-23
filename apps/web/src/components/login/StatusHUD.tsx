import { IconRadar } from '../icons.js';

export function StatusHUD(): JSX.Element {
  return (
    <div className="pointer-events-none absolute right-6 top-6 z-20 hidden items-center gap-3 sm:flex">
      <div className="text-right leading-tight">
        <div className="flex items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-200">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
            style={{
              boxShadow: '0 0 8px rgba(52,211,153,0.9)',
              animation: 'statusPulse 2.4s ease-in-out infinite',
            }}
          />
          <span>SYSTEM ONLINE</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">
          All engines operational
        </div>
      </div>
      <div
        className="text-violet-400/70"
        style={{ filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.4))' }}
      >
        <IconRadar size={28} />
      </div>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.85); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="statusPulse"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
