import type { ReactNode } from 'react';
import { HexGridFloor } from './HexGridFloor.js';
import { OrbitalPaths } from './OrbitalPaths.js';
import { ImageStream } from './ImageStream.js';
import { BrandMark } from './BrandMark.js';

interface LoginSceneProps {
  children: ReactNode;
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
          <pattern id="ambient-grid" width={64} height={64} patternUnits="userSpaceOnUse">
            <path
              d="M 64 0 L 0 0 0 64"
              fill="none"
              stroke="rgba(139,92,246,0.025)"
              strokeWidth={1}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ambient-grid)" />
      </svg>
    </div>
  );
}

export function LoginScene({ children }: LoginSceneProps): JSX.Element {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#04040a] text-neutral-100">
      {/* 1. Deep radial background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, #0d0a20 0%, #04040a 60%, #020208 100%)',
        }}
      />

      {/* 2. Hex grid floor */}
      <HexGridFloor />

      {/* 3. Ambient square grid */}
      <AmbientGrid />

      {/* 4. Orbital paths */}
      <OrbitalPaths />

      {/* 5. Image stream — thematic error/failure cards flowing around card */}
      <ImageStream />

      {/* 7. Radial glow behind card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(59,130,246,0.05) 30%, transparent 65%)',
        }}
      />

      {/* 8. Brand + Login card (centered, brand above card) */}
      <div className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center px-4 py-16 md:py-12">
        <div className="flex w-full max-w-[440px] flex-col items-center">
          <BrandMark />
          {children}
        </div>
      </div>
    </div>
  );
}
