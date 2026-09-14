import { useEffect, useState } from 'react';
import { HexGridFloor } from './login/HexGridFloor.js';
import { OrbitalPaths } from './login/OrbitalPaths.js';
import { ImageStream } from './login/ImageStream.js';
import { BrandMark } from './login/BrandMark.js';

interface Props {
  isAuthenticated: boolean;
  onCta: () => void;
}

function AmbientGrid(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        maskImage:
          'radial-gradient(ellipse at center, black 40%, transparent 80%)',
        WebkitMaskImage:
          'radial-gradient(ellipse at center, black 40%, transparent 80%)',
      }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="landing-grid" width={64} height={64} patternUnits="userSpaceOnUse">
            <path
              d="M 64 0 L 0 0 0 64"
              fill="none"
              stroke="rgba(139,92,246,0.03)"
              strokeWidth={1}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#landing-grid)" />
      </svg>
    </div>
  );
}

const ROTATING_LINES = [
  'Autonomous QA that finds bugs before your users do.',
  'Playwright-powered scans. AI-triaged findings. Zero babysitting.',
  'Ship faster. Break less. Let the agent do the hunting.',
];

function RotatingTagline(): JSX.Element {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((v) => (v + 1) % ROTATING_LINES.length), 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-[3.2em] w-full max-w-[520px] text-center">
      {ROTATING_LINES.map((line, i) => (
        <p
          key={line}
          className="absolute inset-0 text-[15px] leading-relaxed text-neutral-300 transition-all duration-700 sm:text-[17px]"
          style={{
            opacity: i === idx ? 1 : 0,
            transform: i === idx ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

function StatusPill(): JSX.Element {
  return (
    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-violet-200/90 backdrop-blur">
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-violet-400/70" />
        <span className="relative h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.9)]" />
      </span>
      Agent Online
    </div>
  );
}

function CtaButton({
  isAuthenticated,
  onClick,
}: {
  isAuthenticated: boolean;
  onClick: () => void;
}): JSX.Element {
  const label = isAuthenticated ? 'Continue to dashboard' : 'Sign in to begin';

  return (
    <button
      onClick={onClick}
      className="group relative mt-8 inline-flex items-center gap-3 overflow-hidden rounded-full border border-violet-400/40 bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500 px-8 py-3.5 text-[15px] font-medium text-white shadow-[0_0_32px_rgba(139,92,246,0.4)] transition-all duration-300 hover:shadow-[0_0_48px_rgba(167,139,250,0.75)] active:scale-[0.98] sm:px-10 sm:text-[16px]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <span className="relative">{label}</span>
      <svg
        className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14M13 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function FeatureRow(): JSX.Element {
  const items = [
    { label: 'Playwright Runners', dot: 'bg-violet-400' },
    { label: 'AI Triage', dot: 'bg-fuchsia-400' },
    { label: 'Regression Campaigns', dot: 'bg-sky-400' },
  ];

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[11px] uppercase tracking-[0.28em] text-neutral-400">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${it.dot} shadow-[0_0_6px_currentColor]`} />
          <span>{it.label}</span>
          {i < items.length - 1 && (
            <span className="ml-6 hidden h-3 w-px bg-white/10 sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}

export function LandingPage({ isAuthenticated, onCta }: Props): JSX.Element {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#04040a] text-neutral-100">
      {/* Deep radial background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, #0d0a20 0%, #04040a 60%, #020208 100%)',
        }}
      />

      {/* Layered scene — reused from sign-in for visual continuity */}
      <HexGridFloor />
      <AmbientGrid />
      <OrbitalPaths />
      <ImageStream />

      {/* Central radial glow behind hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(124,58,237,0.18) 0%, rgba(59,130,246,0.06) 30%, transparent 65%)',
        }}
      />

      {/* Vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Hero */}
      <div className="relative z-10 flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-16 md:py-12">
        <StatusPill />
        <BrandMark />
        <RotatingTagline />
        <CtaButton isAuthenticated={isAuthenticated} onClick={onCta} />
        <FeatureRow />

        {/* Footer bar */}
        <div className="mt-14 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-neutral-500">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/15" />
          <span>Secured</span>
          <span className="h-1 w-1 rounded-full bg-violet-500/70" />
          <span>Realtime</span>
          <span className="h-1 w-1 rounded-full bg-violet-500/70" />
          <span>v0.10</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-white/15" />
        </div>
      </div>
    </div>
  );
}
