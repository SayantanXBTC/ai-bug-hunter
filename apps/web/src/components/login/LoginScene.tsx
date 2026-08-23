import type { ReactNode } from 'react';
import { HexGridFloor } from './HexGridFloor.js';
import { OrbitalPaths } from './OrbitalPaths.js';
import { OrbLabelSwarm } from './OrbLabelSwarm.js';
import { TopBrand } from './TopBrand.js';
import { StatusHUD } from './StatusHUD.js';

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

      {/* 5. Orb + label paired swarm (was ComputationalPods + SystemLabels) */}
      <OrbLabelSwarm />

      {/* 7. Radial glow behind card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(59,130,246,0.05) 30%, transparent 65%)',
        }}
      />

      {/* 10. Top brand */}
      <TopBrand />

      {/* 11. Status HUD */}
      <StatusHUD />

      {/* 8. Login card (centered) */}
      <div className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center px-4 py-24 md:py-16">
        <div className="w-full max-w-[440px]">
          {children}
        </div>
      </div>
    </div>
  );
}
