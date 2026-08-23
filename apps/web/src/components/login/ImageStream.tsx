import type { JSX } from 'react';
import { ALL_ERROR_CARDS, ErrorCard, type ErrorCardId } from './assets/errorCards.js';

/**
 * Vertical image-stream hero — thematic to AI Bug Hunter.
 * Columns of error/failure "cards" scroll vertically at different speeds
 * and opposite directions, forming a swarm of the bugs the platform hunts.
 *
 * The centre column is skipped so the login card remains focal. Outer
 * columns are blurred + dimmed for depth.
 *
 * Pure inline SVG cards + CSS keyframes. No new deps. Reduced-motion aware.
 */

interface StreamColumn {
  leftPercent: number; // horizontal anchor
  width: number; // px
  direction: 'up' | 'down';
  duration: number; // seconds per full loop
  delay: number; // seconds
  blur: number; // px
  opacity: number;
  scale: number;
  visibility: 'sm' | 'md' | 'lg';
  seed: number; // rotate index into card list
}

const COLUMNS: StreamColumn[] = [
  // Far left — visible on all breakpoints
  { leftPercent: 3,  width: 220, direction: 'up',   duration: 70, delay: 0,   blur: 2.5, opacity: 0.55, scale: 0.92, visibility: 'sm', seed: 0 },
  // Mid-left — hide on mobile
  { leftPercent: 20, width: 220, direction: 'down', duration: 55, delay: 4,   blur: 1.2, opacity: 0.75, scale: 1.0,  visibility: 'md', seed: 3 },
  // Mid-right — hide on mobile
  { leftPercent: 66, width: 220, direction: 'up',   duration: 60, delay: 2,   blur: 1.2, opacity: 0.75, scale: 1.0,  visibility: 'md', seed: 6 },
  // Far right — visible on all
  { leftPercent: 82, width: 220, direction: 'down', duration: 80, delay: 1.5, blur: 2.5, opacity: 0.55, scale: 0.92, visibility: 'sm', seed: 9 },
];

function buildDeck(seed: number, count: number): ErrorCardId[] {
  const out: ErrorCardId[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = (seed + i * 3) % ALL_ERROR_CARDS.length;
    const id = ALL_ERROR_CARDS[idx];
    if (id) out.push(id);
  }
  return out;
}

function visibilityClass(v: StreamColumn['visibility']): string {
  if (v === 'lg') return 'hidden lg:block';
  if (v === 'md') return 'hidden md:block';
  return 'block';
}

function Column({ col }: { col: StreamColumn }): JSX.Element {
  // Render deck twice for seamless loop
  const half = buildDeck(col.seed, 6);
  const full = [...half, ...half];
  const animName = col.direction === 'up' ? 'streamUp' : 'streamDown';
  return (
    <div
      className={`image-stream-col pointer-events-none absolute top-0 h-full ${visibilityClass(col.visibility)}`}
      style={{
        left: `${col.leftPercent}%`,
        width: col.width,
        opacity: col.opacity,
        filter: `blur(${col.blur}px)`,
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
      }}
      aria-hidden="true"
    >
      <div
        className="image-stream-track flex flex-col gap-6"
        style={{
          animation: `${animName} ${col.duration}s linear ${col.delay}s infinite`,
          willChange: 'transform',
          transform: `scale(${col.scale})`,
          transformOrigin: 'top center',
        }}
      >
        {full.map((id, i) => (
          <div
            key={`${id}-${i}`}
            style={{
              animation: `cardBreathe ${8 + (i % 4)}s ease-in-out ${i * 0.7}s infinite`,
              transform: `rotate(${((i % 5) - 2) * 0.6}deg)`,
            }}
          >
            <ErrorCard id={id} />
          </div>
        ))}
      </div>
    </div>
  );
}

const STREAM_KEYFRAMES = `
  @keyframes streamUp {
    0%   { transform: translate3d(0, 0, 0) scale(1); }
    100% { transform: translate3d(0, -50%, 0) scale(1); }
  }
  @keyframes streamDown {
    0%   { transform: translate3d(0, -50%, 0) scale(1); }
    100% { transform: translate3d(0, 0, 0) scale(1); }
  }
  @keyframes cardBreathe {
    0%, 100% { opacity: 0.85; }
    50%      { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .image-stream-track { animation: none !important; }
    .image-stream-track > div { animation: none !important; }
  }
`;

export function ImageStream(): JSX.Element {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <style>{STREAM_KEYFRAMES}</style>
      {COLUMNS.map((c, i) => (
        <Column key={i} col={c} />
      ))}
      {/* Dim overlay preserves card focus */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 480px 520px at 50% 50%, rgba(4,4,10,0.85) 0%, rgba(4,4,10,0.4) 55%, transparent 100%)',
        }}
      />
    </div>
  );
}
