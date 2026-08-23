import type { ReactNode } from 'react';

type Variant = 'planet' | 'nodes' | 'constellation' | 'ring';
type Accent = 'violet' | 'cyan' | 'blue';

interface CTA {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface Props {
  title: string;
  subtitle: string;
  cta?: CTA;
  visualization?: Variant;
  accent?: Accent;
}

const ACCENT_TEXT: Record<Accent, string> = {
  violet: 'text-[var(--primary)]',
  cyan: 'text-[var(--secondary)]',
  blue: 'text-sky-400',
};

function PlanetViz(): JSX.Element {
  return (
    <svg
      width={280}
      height={280}
      viewBox="0 0 280 280"
      aria-hidden="true"
      focusable="false"
      className="oe-viz"
    >
      <defs>
        <radialGradient id="oe-planet" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="0.10" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="oe-orbit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--secondary)" />
        </linearGradient>
      </defs>
      <circle cx="140" cy="140" r="60" fill="url(#oe-planet)" />
      <circle cx="140" cy="140" r="26" fill="currentColor" opacity="0.55" />
      <circle cx="140" cy="140" r="14" fill="currentColor" />
      <g className="oe-spin-slow" style={{ transformOrigin: '140px 140px' }}>
        <ellipse
          cx="140"
          cy="140"
          rx="120"
          ry="42"
          fill="none"
          stroke="url(#oe-orbit)"
          strokeWidth="0.8"
          strokeDasharray="3 6"
          opacity="0.55"
        />
        <circle cx="260" cy="140" r="4" fill="var(--primary)" />
      </g>
      <g
        className="oe-spin-mid"
        style={{ transformOrigin: '140px 140px', transform: 'rotate(35deg)' }}
      >
        <ellipse
          cx="140"
          cy="140"
          rx="100"
          ry="30"
          fill="none"
          stroke="url(#oe-orbit)"
          strokeWidth="0.8"
          strokeDasharray="2 5"
          opacity="0.5"
        />
        <circle cx="40" cy="140" r="3.5" fill="var(--secondary)" />
      </g>
      <g
        className="oe-spin-fast"
        style={{ transformOrigin: '140px 140px', transform: 'rotate(-25deg)' }}
      >
        <ellipse
          cx="140"
          cy="140"
          rx="80"
          ry="24"
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="0.6"
          strokeDasharray="1 4"
          opacity="0.65"
        />
        <circle cx="220" cy="140" r="2.5" fill="var(--primary)" />
      </g>
    </svg>
  );
}

function NodesViz(): JSX.Element {
  const nodes = [
    { cx: 70, cy: 80, r: 6, c: 'var(--primary)' },
    { cx: 200, cy: 60, r: 4, c: 'var(--secondary)' },
    { cx: 140, cy: 140, r: 8, c: 'var(--primary)' },
    { cx: 220, cy: 180, r: 5, c: 'var(--secondary)' },
    { cx: 80, cy: 210, r: 6, c: 'var(--primary)' },
    { cx: 190, cy: 230, r: 4, c: 'var(--secondary)' },
    { cx: 50, cy: 150, r: 3, c: 'var(--primary)' },
    { cx: 250, cy: 120, r: 3, c: 'var(--secondary)' },
  ];
  const lines: Array<[number, number]> = [
    [0, 2],
    [2, 1],
    [2, 3],
    [2, 4],
    [4, 5],
    [3, 5],
    [0, 6],
    [1, 7],
    [6, 4],
  ];
  return (
    <svg
      width={280}
      height={280}
      viewBox="0 0 280 280"
      aria-hidden="true"
      focusable="false"
      className="oe-viz"
    >
      <g stroke="var(--border-strong)" strokeWidth="0.8" opacity="0.7">
        {lines.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a]!.cx}
            y1={nodes[a]!.cy}
            x2={nodes[b]!.cx}
            y2={nodes[b]!.cy}
          />
        ))}
      </g>
      {nodes.map((n, i) => (
        <g key={i} className="oe-pulse" style={{ animationDelay: `${i * 200}ms` }}>
          <circle cx={n.cx} cy={n.cy} r={n.r + 3} fill={n.c} opacity="0.18" />
          <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.c} />
        </g>
      ))}
    </svg>
  );
}

function ConstellationViz(): JSX.Element {
  const nodes = [
    { cx: 140, cy: 60, r: 10, c: 'var(--danger)' },
    { cx: 70, cy: 140, r: 8, c: 'var(--warning)' },
    { cx: 210, cy: 140, r: 8, c: 'var(--primary)' },
    { cx: 110, cy: 220, r: 6, c: 'var(--secondary)' },
    { cx: 200, cy: 210, r: 7, c: 'var(--primary)' },
  ];
  return (
    <svg
      width={280}
      height={280}
      viewBox="0 0 280 280"
      aria-hidden="true"
      focusable="false"
      className="oe-viz"
    >
      <g fill="none" stroke="var(--border-strong)" strokeWidth="1" opacity="0.7">
        <path d="M140 60 Q 100 100 70 140" />
        <path d="M140 60 Q 180 100 210 140" />
        <path d="M70 140 Q 90 190 110 220" />
        <path d="M210 140 Q 200 180 200 210" />
        <path d="M110 220 Q 155 230 200 210" />
        <path d="M70 140 Q 140 160 210 140" strokeDasharray="2 4" />
      </g>
      {nodes.map((n, i) => (
        <g key={i} className="oe-pulse" style={{ animationDelay: `${i * 250}ms` }}>
          <circle cx={n.cx} cy={n.cy} r={n.r + 6} fill={n.c} opacity="0.15" />
          <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.c} opacity="0.9" />
        </g>
      ))}
    </svg>
  );
}

function RingViz(): JSX.Element {
  const r = 100;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={280}
      height={280}
      viewBox="0 0 280 280"
      aria-hidden="true"
      focusable="false"
      className="oe-viz"
    >
      <defs>
        <linearGradient id="oe-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--secondary)" />
        </linearGradient>
      </defs>
      <circle cx="140" cy="140" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle
        cx="140"
        cy="140"
        r={r}
        fill="none"
        stroke="url(#oe-ring)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${c * 0.15} ${c}`}
        transform="rotate(-90 140 140)"
        opacity="0.85"
      />
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * 2 * Math.PI;
        const x1 = 140 + Math.cos(angle) * 118;
        const y1 = 140 + Math.sin(angle) * 118;
        const x2 = 140 + Math.cos(angle) * 126;
        const y2 = 140 + Math.sin(angle) * 126;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--text-subtle)"
            strokeWidth="1"
            opacity="0.6"
          />
        );
      })}
      <text
        x="140"
        y="146"
        textAnchor="middle"
        fontSize="42"
        fontWeight="600"
        fill="var(--text-subtle)"
      >
        —
      </text>
      <text
        x="140"
        y="170"
        textAnchor="middle"
        fontSize="10"
        letterSpacing="4"
        fill="var(--text-subtle)"
      >
        /100
      </text>
    </svg>
  );
}

function pickViz(v: Variant): JSX.Element {
  switch (v) {
    case 'nodes':
      return <NodesViz />;
    case 'constellation':
      return <ConstellationViz />;
    case 'ring':
      return <RingViz />;
    case 'planet':
    default:
      return <PlanetViz />;
  }
}

export function OrbitalEmptyState({
  title,
  subtitle,
  cta,
  visualization = 'planet',
  accent = 'violet',
}: Props): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-glass)] p-10 text-center backdrop-blur-md">
      <div className={ACCENT_TEXT[accent]}>{pickViz(visualization)}</div>
      <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-[var(--text)]">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">{subtitle}</p>
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white shadow-[0_4px_16px_-4px_var(--primary-soft)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          {cta.icon}
          {cta.label}
        </button>
      )}
      <style>{`
        .oe-spin-slow { animation: oeSpin 60s linear infinite; }
        .oe-spin-mid { animation: oeSpin 45s linear infinite reverse; }
        .oe-spin-fast { animation: oeSpin 30s linear infinite; }
        .oe-pulse { animation: oePulse 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes oeSpin { to { transform: rotate(360deg); } }
        @keyframes oePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        @media (prefers-reduced-motion: reduce) {
          .oe-spin-slow, .oe-spin-mid, .oe-spin-fast, .oe-pulse { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
