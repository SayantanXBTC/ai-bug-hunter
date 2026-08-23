/**
 * Decorative elliptical orbital paths with traveling glow dots.
 * Pure SVG + CSS keyframes.
 */

interface Orbit {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate: number;
  color: string;
  opacity: number;
  spin?: number; // seconds for slow rotation
  dotDur?: number; // seconds for motion-path traversal
  dotColor?: string;
  hideBelow?: 'md' | 'lg';
}

const ORBITS: Orbit[] = [
  { cx: 50, cy: 45, rx: 42, ry: 18, rotate: -8,  color: 'rgba(139,92,246,0.22)', opacity: 0.9, spin: 120, dotDur: 60, dotColor: '#a78bfa' },
  { cx: 50, cy: 50, rx: 36, ry: 14, rotate: 14,  color: 'rgba(96,165,250,0.18)', opacity: 0.8, spin: 180, dotDur: 75, dotColor: '#60a5fa' },
  { cx: 30, cy: 55, rx: 28, ry: 12, rotate: -22, color: 'rgba(34,211,238,0.16)', opacity: 0.7, spin: 90,  dotDur: 55, dotColor: '#22d3ee', hideBelow: 'lg' },
  { cx: 70, cy: 40, rx: 26, ry: 11, rotate: 30,  color: 'rgba(139,92,246,0.16)', opacity: 0.7, spin: 150, dotDur: 70, dotColor: '#a78bfa', hideBelow: 'lg' },
  { cx: 50, cy: 55, rx: 48, ry: 22, rotate: 4,   color: 'rgba(139,92,246,0.10)', opacity: 0.6, spin: 220, hideBelow: 'md' },
  { cx: 50, cy: 42, rx: 22, ry: 9,  rotate: -18, color: 'rgba(96,165,250,0.20)', opacity: 0.75, dotDur: 45, dotColor: '#60a5fa' },
];

export function OrbitalPaths(): JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <style>{`
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .orbit-path { transform-box: fill-box; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) {
          .orbit-path, .orbit-dot { animation: none !important; }
        }
      `}</style>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {ORBITS.map((o, i) => {
          const id = `orbit-${i}`;
          const hideClass =
            o.hideBelow === 'lg' ? 'hidden lg:inline' : o.hideBelow === 'md' ? 'hidden md:inline' : '';
          return (
            <g key={id} className={hideClass} opacity={o.opacity}>
              <g
                className="orbit-path"
                style={
                  o.spin
                    ? {
                        transformOrigin: `${o.cx}% ${o.cy}%`,
                        animation: `orbitSpin ${o.spin}s linear infinite`,
                      }
                    : undefined
                }
              >
                <ellipse
                  id={id}
                  cx={o.cx}
                  cy={o.cy}
                  rx={o.rx}
                  ry={o.ry}
                  transform={`rotate(${o.rotate} ${o.cx} ${o.cy})`}
                  fill="none"
                  stroke={o.color}
                  strokeWidth={0.15}
                  strokeDasharray="0.6 1.4"
                  vectorEffect="non-scaling-stroke"
                />
                {o.dotDur && o.dotColor && (
                  <circle r={0.5} fill={o.dotColor} className="orbit-dot">
                    <animateMotion
                      dur={`${o.dotDur}s`}
                      repeatCount="indefinite"
                      rotate="auto"
                      path={`M ${o.cx - o.rx} ${o.cy} a ${o.rx} ${o.ry} ${o.rotate} 1 0 ${o.rx * 2} 0 a ${o.rx} ${o.ry} ${o.rotate} 1 0 ${-o.rx * 2} 0`}
                    />
                  </circle>
                )}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
