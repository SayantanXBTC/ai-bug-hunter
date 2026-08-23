import type { CSSProperties } from 'react';

/**
 * Decorative orb+label paired traveling units for the login scene.
 *
 * Replaces the previous ComputationalPods + SystemLabels components — each
 * system function now travels as a single unit (label above, orb below) with
 * matching accent color. Pure SVG + CSS keyframes, all aria-hidden.
 */

type Accent = 'violet' | 'blue' | 'cyan' | 'magenta';
type Anim = 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
type Visibility = 'sm' | 'md' | 'lg';

interface Pair {
  id: string;
  title: string;
  subtitle: string;
  accent: Accent;
  anim: Anim;
  // Position — absolute % within the scene, top-left anchored
  left: string;
  top: string;
  // Orb SVG width (px); height auto-derived
  width: number;
  duration: number;
  delay: number;
  align: 'left' | 'right';
  visibility: Visibility;
}

const PAIRS: Pair[] = [
  { id: 'discover',     title: 'DISCOVER',     subtitle: 'Scanning applications', accent: 'violet',  anim: 'a', left: '4%',  top: '12%', width: 120, duration: 72, delay: 0,   align: 'left',  visibility: 'sm' },
  { id: 'intelligence', title: 'INTELLIGENCE', subtitle: 'AI investigation',      accent: 'violet',  anim: 'b', left: '78%', top: '10%', width: 120, duration: 88, delay: 2,   align: 'right', visibility: 'sm' },
  { id: 'execute',      title: 'EXECUTE',      subtitle: 'Running tests',         accent: 'blue',    anim: 'c', left: '2%',  top: '48%', width: 92,  duration: 64, delay: 4,   align: 'left',  visibility: 'md' },
  { id: 'cluster',      title: 'CLUSTER',      subtitle: 'Detecting patterns',    accent: 'magenta', anim: 'd', left: '82%', top: '46%', width: 92,  duration: 78, delay: 1,   align: 'right', visibility: 'md' },
  { id: 'analyze',      title: 'ANALYZE',      subtitle: 'Collecting evidence',   accent: 'cyan',    anim: 'e', left: '6%',  top: '78%', width: 120, duration: 92, delay: 3,   align: 'left',  visibility: 'lg' },
  { id: 'improve',      title: 'IMPROVE',      subtitle: 'Quality over time',     accent: 'blue',    anim: 'f', left: '74%', top: '80%', width: 90,  duration: 96, delay: 5,   align: 'right', visibility: 'lg' },
];

interface AccentTokens {
  labelText: string; // Tailwind class
  labelSub: string;
  rule: string; // Tailwind gradient from-* class
  // SVG gradient stops
  highlight: string;
  mid: string;
  deep: string;
  glowRGBA: string; // css color for glow
}

const ACCENT: Record<Accent, AccentTokens> = {
  violet: {
    labelText: 'text-violet-300',
    labelSub: 'text-neutral-500',
    rule: 'from-violet-500/70',
    highlight: '#e9d5ff',
    mid: '#7c3aed',
    deep: '#4c1d95',
    glowRGBA: 'rgba(167,139,250,0.55)',
  },
  blue: {
    labelText: 'text-blue-300',
    labelSub: 'text-neutral-500',
    rule: 'from-blue-500/70',
    highlight: '#dbeafe',
    mid: '#3b82f6',
    deep: '#1e3a8a',
    glowRGBA: 'rgba(96,165,250,0.55)',
  },
  cyan: {
    labelText: 'text-cyan-300',
    labelSub: 'text-neutral-500',
    rule: 'from-cyan-500/70',
    highlight: '#cffafe',
    mid: '#22d3ee',
    deep: '#0e7490',
    glowRGBA: 'rgba(103,232,249,0.55)',
  },
  magenta: {
    labelText: 'text-pink-300',
    labelSub: 'text-neutral-500',
    rule: 'from-pink-500/70',
    highlight: '#fce7f3',
    mid: '#ec4899',
    deep: '#9d174d',
    glowRGBA: 'rgba(244,114,182,0.55)',
  },
};

function visibilityClass(v: Visibility): string {
  if (v === 'lg') return 'hidden lg:block';
  if (v === 'md') return 'hidden md:block';
  return 'block'; // 'sm' — always visible
}

function Orb({ pair }: { pair: Pair }): JSX.Element {
  const g = ACCENT[pair.accent];
  const w = pair.width;
  const h = Math.round(w * 0.58);
  const cx = w / 2;
  const cy = h / 2;
  const bodyRx = w * 0.42;
  const bodyRy = h * 0.36;

  const uid = pair.id;
  return (
    <svg
      className="orb block"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
      style={{ filter: `drop-shadow(0 6px 18px ${g.glowRGBA})` }}
    >
      <defs>
        <linearGradient id={`orb-body-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c1a2e" />
          <stop offset="55%" stopColor="#0e0c1e" />
          <stop offset="100%" stopColor="#050410" />
        </linearGradient>
        <linearGradient id={`orb-core-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={g.mid} stopOpacity="0" />
          <stop offset="20%" stopColor={g.mid} stopOpacity="0.75" />
          <stop offset="50%" stopColor={g.highlight} />
          <stop offset="80%" stopColor={g.mid} stopOpacity="0.75" />
          <stop offset="100%" stopColor={g.mid} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`orb-atmo-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={g.mid} stopOpacity="0.5" />
          <stop offset="60%" stopColor={g.mid} stopOpacity="0.12" />
          <stop offset="100%" stopColor={g.mid} stopOpacity="0" />
        </radialGradient>
        <filter id={`orb-blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id={`orb-blur-sm-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* Outer atmospheric glow */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={bodyRx * 1.6}
        ry={bodyRy * 1.8}
        fill={`url(#orb-atmo-${uid})`}
        opacity={0.9}
        filter={`url(#orb-blur-${uid})`}
      />

      {/* Bottom grounding shadow */}
      <ellipse
        cx={cx}
        cy={cy + bodyRy * 0.9}
        rx={bodyRx * 0.85}
        ry={bodyRy * 0.22}
        fill="#000"
        opacity={0.55}
        filter={`url(#orb-blur-sm-${uid})`}
      />

      {/* Orbital ring (dashed, tilted, pulsing) */}
      <g
        className="orb-ring"
        transform={`rotate(-14 ${cx} ${cy})`}
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: `orbRingPulse 4.5s ease-in-out infinite`,
        }}
      >
        <ellipse
          cx={cx}
          cy={cy}
          rx={bodyRx * 1.15}
          ry={bodyRy * 1.35}
          fill="none"
          stroke={g.mid}
          strokeOpacity={0.4}
          strokeWidth={0.7}
          strokeDasharray="1 3"
        />
      </g>

      {/* Metallic body base */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={bodyRx}
        ry={bodyRy}
        fill={`url(#orb-body-${uid})`}
        stroke="rgba(255,255,255,0.09)"
        strokeWidth={0.7}
      />

      {/* Top-lit reflection arc */}
      <path
        d={`M ${cx - bodyRx * 0.7} ${cy - bodyRy * 0.55}
            Q ${cx - bodyRx * 0.2} ${cy - bodyRy * 0.9} ${cx + bodyRx * 0.15} ${cy - bodyRy * 0.7}`}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={0.9}
        fill="none"
        strokeLinecap="round"
      />

      {/* Core outer bloom */}
      <rect
        x={cx - bodyRx * 0.9}
        y={cy - bodyRy * 0.22}
        width={bodyRx * 1.8}
        height={bodyRy * 0.44}
        rx={bodyRy * 0.22}
        fill={`url(#orb-core-${uid})`}
        opacity={0.9}
        filter={`url(#orb-blur-sm-${uid})`}
      />

      {/* Sharp core stripe (animated pulse) */}
      <g
        className="orb-core-pulse"
        style={{ animation: `orbCorePulse 3s ease-in-out infinite` }}
      >
        <rect
          x={cx - bodyRx * 0.75}
          y={cy - bodyRy * 0.1}
          width={bodyRx * 1.5}
          height={bodyRy * 0.2}
          rx={bodyRy * 0.1}
          fill={`url(#orb-core-${uid})`}
        />
        {/* White-hot center dot */}
        <circle cx={cx} cy={cy} r={Math.max(1.4, w * 0.018)} fill="#ffffff" />
      </g>
    </svg>
  );
}

function OrbPair({ pair }: { pair: Pair }): JSX.Element {
  const g = ACCENT[pair.accent];
  const style: CSSProperties = {
    position: 'absolute',
    left: pair.left,
    top: pair.top,
    animation: `pairDrift-${pair.anim} ${pair.duration}s ease-in-out ${pair.delay}s infinite`,
    willChange: 'transform',
  };
  const isLeft = pair.align === 'left';
  return (
    <div
      className={`orb-pair pointer-events-none ${visibilityClass(pair.visibility)}`}
      style={style}
      aria-hidden="true"
    >
      <div
        className={`hud-label opacity-70 flex flex-col ${isLeft ? 'items-start' : 'items-end'}`}
      >
        <div
          className={`text-[10px] font-semibold uppercase tracking-[0.3em] ${g.labelText}`}
        >
          {pair.title}
        </div>
        <div
          className={`w-6 h-px my-1 bg-gradient-to-r ${g.rule} to-transparent`}
        />
        <div className={`text-[11px] ${g.labelSub}`}>{pair.subtitle}</div>
      </div>
      <div className={`mt-3 flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
        <Orb pair={pair} />
      </div>
    </div>
  );
}

const SWARM_KEYFRAMES = `
  /* Large multi-waypoint drifts.
     Each pair traverses a wide arc across the viewport, avoiding the
     centered ~500px login card zone via horizontal waypoints that stay
     in outer bands. Uses vw/vh so paths scale with viewport. */
  @keyframes pairDrift-a {
    0%   { transform: translate3d(0,    0,    0) rotate(0deg); }
    25%  { transform: translate3d(28vw, 8vh,  0) rotate(2deg); }
    50%  { transform: translate3d(62vw, 40vh, 0) rotate(-1deg); }
    75%  { transform: translate3d(30vw, 62vh, 0) rotate(3deg); }
    100% { transform: translate3d(0,    0,    0) rotate(0deg); }
  }
  @keyframes pairDrift-b {
    0%   { transform: translate3d(0,     0,    0) rotate(0deg); }
    25%  { transform: translate3d(-30vw, 12vh, 0) rotate(-2deg); }
    50%  { transform: translate3d(-64vw, 44vh, 0) rotate(1deg); }
    75%  { transform: translate3d(-28vw, 66vh, 0) rotate(-3deg); }
    100% { transform: translate3d(0,     0,    0) rotate(0deg); }
  }
  @keyframes pairDrift-c {
    0%   { transform: translate3d(0,    0,     0) rotate(0deg); }
    25%  { transform: translate3d(24vw, -28vh, 0) rotate(2deg); }
    50%  { transform: translate3d(58vw, -10vh, 0) rotate(-1deg); }
    75%  { transform: translate3d(34vw, 24vh,  0) rotate(1deg); }
    100% { transform: translate3d(0,    0,     0) rotate(0deg); }
  }
  @keyframes pairDrift-d {
    0%   { transform: translate3d(0,     0,     0) rotate(0deg); }
    25%  { transform: translate3d(-26vw, 22vh,  0) rotate(-2deg); }
    50%  { transform: translate3d(-60vw, -6vh,  0) rotate(3deg); }
    75%  { transform: translate3d(-32vw, -26vh, 0) rotate(-1deg); }
    100% { transform: translate3d(0,     0,     0) rotate(0deg); }
  }
  @keyframes pairDrift-e {
    0%   { transform: translate3d(0,    0,     0) rotate(0deg); }
    25%  { transform: translate3d(30vw, -22vh, 0) rotate(2deg); }
    50%  { transform: translate3d(64vw, -50vh, 0) rotate(-2deg); }
    75%  { transform: translate3d(28vw, -32vh, 0) rotate(1deg); }
    100% { transform: translate3d(0,    0,     0) rotate(0deg); }
  }
  @keyframes pairDrift-f {
    0%   { transform: translate3d(0,     0,     0) rotate(0deg); }
    25%  { transform: translate3d(-32vw, -18vh, 0) rotate(-3deg); }
    50%  { transform: translate3d(-66vw, -52vh, 0) rotate(2deg); }
    75%  { transform: translate3d(-30vw, -34vh, 0) rotate(-1deg); }
    100% { transform: translate3d(0,     0,     0) rotate(0deg); }
  }
  @keyframes orbCorePulse {
    0%, 100% { opacity: 0.85; }
    50%      { opacity: 1; }
  }
  @keyframes orbRingPulse {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.9; }
  }
  @media (prefers-reduced-motion: reduce) {
    .orb-pair, .orb-ring, .orb-core-pulse { animation: none !important; }
  }
`;

export function OrbLabelSwarm(): JSX.Element {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <style>{SWARM_KEYFRAMES}</style>
      {PAIRS.map((p) => (
        <OrbPair key={p.id} pair={p} />
      ))}
    </div>
  );
}
