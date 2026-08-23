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
      <style>{`
        @keyframes hexPulse {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.75; }
        }
        .hex-dot { animation: hexPulse 8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hex-dot { animation: none !important; }
        }
      `}</style>
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
            <pattern id="hex-dots" width={260} height={225} patternUnits="userSpaceOnUse">
              <circle cx="26" cy="22" r="1.2" fill="#a78bfa" className="hex-dot" />
              <circle cx="156" cy="112" r="1.2" fill="#60a5fa" className="hex-dot" style={{ animationDelay: '2s' }} />
              <circle cx="234" cy="45" r="1.2" fill="#a78bfa" className="hex-dot" style={{ animationDelay: '4s' }} />
              <circle cx="78" cy="180" r="1.2" fill="#22d3ee" className="hex-dot" style={{ animationDelay: '1s' }} />
              <circle cx="208" cy="200" r="1.2" fill="#a78bfa" className="hex-dot" style={{ animationDelay: '5s' }} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex-floor)" />
          <rect width="100%" height="100%" fill="url(#hex-dots)" />
        </svg>
      </div>
    </div>
  );
}
