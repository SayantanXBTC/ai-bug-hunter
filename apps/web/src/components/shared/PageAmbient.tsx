/**
 * Ambient page backdrop — carries the login-scene DNA into every page:
 * deep radial gradient, faint hex-grid floor, orbital ring, subtle
 * drifting motes. Uses theme tokens so it responds to dark/light switch.
 */
export function PageAmbient(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* 1. Base gradient */}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--ambient-bg)' }}
      />

      {/* 2. Faint hex-floor (mirrors login HexGridFloor) */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[55%] w-full motion-reduce:hidden"
        style={{ opacity: 'var(--grid-opacity)' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="pa-hex"
            width="56"
            height="48.5"
            patternUnits="userSpaceOnUse"
            patternTransform="translate(0,0)"
          >
            <path
              d="M14 0 L42 0 L56 24.25 L42 48.5 L14 48.5 L0 24.25 Z"
              fill="none"
              stroke="var(--grid-stroke)"
              strokeWidth="0.5"
            />
          </pattern>
          <linearGradient id="pa-hex-mask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="black" stopOpacity="0" />
            <stop offset="1" stopColor="black" stopOpacity="1" />
          </linearGradient>
          <mask id="pa-hex-fade">
            <rect width="100%" height="100%" fill="url(#pa-hex-mask)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#pa-hex)" mask="url(#pa-hex-fade)" />
      </svg>

      {/* 3. Square micro-grid (subtle) */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ opacity: 'calc(var(--grid-opacity) * 0.7)' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="pa-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="var(--grid-stroke)" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pa-grid)" />
      </svg>

      {/* 4. Orbital ring + drifting motes */}
      <svg
        className="absolute inset-0 h-full w-full motion-reduce:hidden"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="pa-orbit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--secondary)" />
          </linearGradient>
          <radialGradient id="pa-glow" cx="50%" cy="30%" r="60%">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.14" />
            <stop offset="0.5" stopColor="var(--secondary)" stopOpacity="0.05" />
            <stop offset="1" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="1200" height="800" fill="url(#pa-glow)" />
        <g style={{ animation: 'paDrift 90s linear infinite' }}>
          <circle cx="180" cy="140" r="1.6" fill="var(--primary)" opacity="0.5" />
          <circle cx="960" cy="220" r="1.4" fill="var(--secondary)" opacity="0.4" />
          <circle cx="740" cy="640" r="1.6" fill="var(--primary)" opacity="0.35" />
        </g>
        <circle
          cx="600"
          cy="400"
          r="260"
          fill="none"
          stroke="url(#pa-orbit)"
          strokeWidth="0.6"
          strokeDasharray="2 8"
          opacity="0.25"
          style={{ transformOrigin: '600px 400px', animation: 'paSpin 120s linear infinite' }}
        />
        <circle
          cx="600"
          cy="400"
          r="420"
          fill="none"
          stroke="url(#pa-orbit)"
          strokeWidth="0.4"
          strokeDasharray="1 12"
          opacity="0.15"
          style={{ transformOrigin: '600px 400px', animation: 'paSpinRev 200s linear infinite' }}
        />
      </svg>

      <style>{`
        @keyframes paDrift { 0% { transform: translate3d(0,0,0);} 50% { transform: translate3d(20px,-14px,0);} 100% { transform: translate3d(0,0,0);} }
        @keyframes paSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes paSpinRev { from { transform: rotate(0deg);} to { transform: rotate(-360deg);} }
        @media (prefers-reduced-motion: reduce) {
          [style*="paDrift"], [style*="paSpin"], [style*="paSpinRev"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
