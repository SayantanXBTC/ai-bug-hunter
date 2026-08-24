/**
 * Premium centered brand mark — sits above the login card as one unit.
 * 3D depth via layered transforms, chromatic gradient text, glowing hex
 * logo with animated inner glyph. Replaces the corner TopBrand and the
 * card's internal header.
 */
export function BrandMark(): JSX.Element {
  return (
    <div className="relative mb-8 flex flex-col items-center" aria-label="AI Bug Hunter">
      <style>{`
        @keyframes brand-hex-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes brand-core-pulse {
          0%, 100% { opacity: 0.75; filter: drop-shadow(0 0 10px rgba(167,139,250,0.55)); }
          50%      { opacity: 1;    filter: drop-shadow(0 0 18px rgba(167,139,250,0.85)); }
        }
        @keyframes brand-shine {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .brand-hex-ring { animation: brand-hex-spin 40s linear infinite; }
        .brand-hex-core { animation: brand-core-pulse 3.5s ease-in-out infinite; }
        .brand-wordmark {
          background: linear-gradient(
            90deg,
            #ffffff 0%,
            #ffffff 30%,
            #c4b5fd 50%,
            #ffffff 70%,
            #ffffff 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: brand-shine 6s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .brand-hex-ring, .brand-hex-core, .brand-wordmark {
            animation: none !important;
          }
        }
      `}</style>

      {/* Logo — 3D layered hex mark */}
      <div
        className="relative mb-4"
        style={{ perspective: 800 }}
      >
        {/* Under-glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.55) 0%, rgba(59,130,246,0.15) 45%, transparent 75%)',
          }}
        />
        <div
          className="relative"
          style={{
            transform: 'rotateX(18deg) rotateY(-6deg)',
            transformStyle: 'preserve-3d',
          }}
        >
          <svg
            width={76}
            height={76}
            viewBox="0 0 100 100"
            aria-hidden="true"
            focusable="false"
            className="drop-shadow-[0_10px_20px_rgba(124,58,237,0.45)]"
          >
            <defs>
              <linearGradient id="brand-hex-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(139,92,246,0.35)" />
                <stop offset="55%" stopColor="rgba(76,29,149,0.55)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.85)" />
              </linearGradient>
              <linearGradient id="brand-hex-stroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c4b5fd" />
                <stop offset="60%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#4c1d95" />
              </linearGradient>
              <linearGradient id="brand-node-stroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e9d5ff" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <radialGradient id="brand-node-fill" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f5f3ff" />
                <stop offset="60%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#4c1d95" />
              </radialGradient>
              <filter id="brand-inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feOffset dy="1.5" />
              </filter>
            </defs>

            {/* Depth: layered offset hexes for parallax */}
            <g transform="translate(0.5, 0.5)" opacity={0.35}>
              <polygon
                points="50,4 87,25 87,75 50,96 13,75 13,25"
                fill="none"
                stroke="rgba(139,92,246,0.35)"
                strokeWidth={1}
              />
            </g>
            <g transform="translate(-0.5, -0.5)" opacity={0.5}>
              <polygon
                points="50,4 87,25 87,75 50,96 13,75 13,25"
                fill="none"
                stroke="rgba(139,92,246,0.5)"
                strokeWidth={1}
              />
            </g>

            {/* Main hex body */}
            <polygon
              points="50,4 87,25 87,75 50,96 13,75 13,25"
              fill="url(#brand-hex-fill)"
              stroke="url(#brand-hex-stroke)"
              strokeWidth={2}
              filter="url(#brand-inner-shadow)"
            />

            {/* Rotating dashed inner ring */}
            <g className="brand-hex-ring" style={{ transformOrigin: '50px 50px' }}>
              <circle
                cx={50}
                cy={50}
                r={26}
                fill="none"
                stroke="rgba(196,181,253,0.35)"
                strokeWidth={0.6}
                strokeDasharray="2 3"
              />
            </g>

            {/* Node-graph glyph — 3 nodes + connecting lines */}
            <g className="brand-hex-core">
              <line x1={50} y1={36} x2={36} y2={58} stroke="url(#brand-node-stroke)" strokeWidth={1.6} strokeLinecap="round" />
              <line x1={50} y1={36} x2={64} y2={58} stroke="url(#brand-node-stroke)" strokeWidth={1.6} strokeLinecap="round" />
              <line x1={36} y1={58} x2={64} y2={58} stroke="url(#brand-node-stroke)" strokeWidth={1.6} strokeLinecap="round" />

              <circle cx={50} cy={36} r={5} fill="url(#brand-node-fill)" stroke="#f5f3ff" strokeWidth={0.6} />
              <circle cx={36} cy={58} r={4} fill="url(#brand-node-fill)" stroke="#f5f3ff" strokeWidth={0.6} />
              <circle cx={64} cy={58} r={4} fill="url(#brand-node-fill)" stroke="#f5f3ff" strokeWidth={0.6} />
            </g>

            {/* Top rim highlight for 3D bevel */}
            <path
              d="M 50 4 L 87 25"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={0.8}
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 13 25 L 50 4"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={0.6}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
      </div>

      {/* Wordmark */}
      <div className="text-center leading-tight">
        <h1
          className="brand-wordmark text-2xl font-bold tracking-[0.22em] uppercase sm:text-3xl"
          style={{
            textShadow: '0 2px 20px rgba(124,58,237,0.35)',
          }}
        >
          AI&nbsp;Bug&nbsp;Hunter
        </h1>
        <div className="mx-auto mt-2 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-violet-500/60" />
          <span className="text-[10px] font-medium uppercase tracking-[0.42em] text-violet-300/70">
            v0.10
          </span>
          <span className="h-1 w-1 rounded-full bg-violet-400/70 shadow-[0_0_6px_rgba(167,139,250,0.7)]" />
          <span className="text-[10px] font-medium uppercase tracking-[0.42em] text-neutral-400">
            Autonomous&nbsp;QA
          </span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-violet-500/60" />
        </div>
      </div>
    </div>
  );
}
