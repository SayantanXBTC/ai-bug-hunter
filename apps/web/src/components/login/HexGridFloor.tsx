/**
 * Perspective hexagonal grid floor — decorative.
 * SVG pattern rotated in 3D via CSS perspective transform.
 */
export function HexGridFloor(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[45%] md:block"
      style={{
        perspective: '600px',
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 40%, black 85%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 40%, black 85%, transparent 100%)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: 'rotateX(62deg) translateZ(-40px) scale(1.6)',
          transformOrigin: '50% 100%',
        }}
      >
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="hex-floor"
              width={52}
              height={45}
              patternUnits="userSpaceOnUse"
              patternTransform="translate(0 0)"
            >
              {/* Pointy-top hex path */}
              <path
                d="M13 0 L39 0 L52 22.5 L39 45 L13 45 L0 22.5 Z"
                fill="none"
                stroke="rgba(139,92,246,0.13)"
                strokeWidth={0.6}
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex-floor)" />
        </svg>
      </div>
    </div>
  );
}
