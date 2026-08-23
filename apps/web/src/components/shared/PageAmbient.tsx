export function PageAmbient(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 600px at 20% -10%, rgba(139,92,246,0.10), transparent 70%), radial-gradient(900px 500px at 90% 10%, rgba(56,189,248,0.06), transparent 70%), #05060B',
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.05]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="pa-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#8b5cf6" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pa-grid)" />
      </svg>
      <svg
        className="absolute inset-0 h-full w-full motion-reduce:hidden"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        <g style={{ animation: 'paDrift 90s linear infinite' }}>
          <circle cx="180" cy="140" r="1.6" fill="#a78bfa" opacity="0.5" />
          <circle cx="960" cy="220" r="1.4" fill="#38bdf8" opacity="0.4" />
          <circle cx="740" cy="640" r="1.6" fill="#a78bfa" opacity="0.35" />
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
        <defs>
          <linearGradient id="pa-orbit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
      <style>{`
        @keyframes paDrift { 0% { transform: translate3d(0,0,0);} 50% { transform: translate3d(20px,-14px,0);} 100% { transform: translate3d(0,0,0);} }
        @keyframes paSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @media (prefers-reduced-motion: reduce) {
          [style*="paDrift"], [style*="paSpin"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
