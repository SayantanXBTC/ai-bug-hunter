import type { UserRole } from '@ai-bug-hunter/shared';
import type { SVGProps } from 'react';
import {
  IconActivity,
  IconLayers,
  IconSparkles,
  IconList,
  IconBug,
  IconRadar,
  IconTarget,
} from './icons.js';

export type ViewId =
  | 'dashboard'
  | 'applications'
  | 'tests'
  | 'test-runs'
  | 'bugs'
  | 'reliability'
  | 'regression'
  | 'settings';

interface NavEntry {
  id: ViewId;
  label: string;
  minRole?: UserRole;
  icon: (p: SVGProps<SVGSVGElement> & { size?: number }) => JSX.Element;
}

function IconCog(props: SVGProps<SVGSVGElement> & { size?: number }): JSX.Element {
  const { size = 16, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const ENTRIES: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IconActivity },
  { id: 'applications', label: 'Applications', icon: IconLayers },
  { id: 'tests', label: 'Tests', minRole: 'qa_engineer', icon: IconSparkles },
  { id: 'test-runs', label: 'Test Runs', icon: IconList },
  { id: 'bugs', label: 'Bugs', icon: IconBug },
  { id: 'reliability', label: 'Reliability', icon: IconRadar },
  { id: 'regression', label: 'Regression', icon: IconTarget },
  { id: 'settings', label: 'Settings', icon: IconCog },
];

const ROLE_ORDER: Record<UserRole, number> = { viewer: 0, qa_engineer: 1, admin: 2 };

interface Props {
  active: ViewId;
  onNavigate: (id: ViewId) => void;
  role: UserRole;
}

/**
 * Sidebar brand mark — miniature of the login BrandMark hex logo so the
 * shell reads as the same product.
 */
function SidebarHex(): JSX.Element {
  return (
    <div className="relative" style={{ perspective: 500 }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
        style={{
          background:
            'radial-gradient(circle, var(--primary-soft) 0%, transparent 70%)',
        }}
      />
      <svg
        width={30}
        height={30}
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
        style={{ transform: 'rotateX(16deg) rotateY(-6deg)' }}
        className="drop-shadow-[0_4px_10px_rgba(124,58,237,0.35)]"
      >
        <defs>
          <linearGradient id="sb-hex-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="sb-hex-stroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <polygon
          points="50,4 87,25 87,75 50,96 13,75 13,25"
          fill="url(#sb-hex-fill)"
          stroke="url(#sb-hex-stroke)"
          strokeWidth={2.5}
        />
        <g>
          <line x1={50} y1={36} x2={36} y2={58} stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
          <line x1={50} y1={36} x2={64} y2={58} stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
          <line x1={36} y1={58} x2={64} y2={58} stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
          <circle cx={50} cy={36} r={5} fill="var(--primary)" />
          <circle cx={36} cy={58} r={4} fill="var(--primary)" />
          <circle cx={64} cy={58} r={4} fill="var(--primary)" />
        </g>
      </svg>
    </div>
  );
}

export function Sidebar({ active, onNavigate, role }: Props): JSX.Element {
  const visible = ENTRIES.filter((e) => {
    if (!e.minRole) return true;
    return ROLE_ORDER[role] >= ROLE_ORDER[e.minRole];
  });

  return (
    <aside
      className="relative w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text-muted)]"
      style={{
        backgroundImage:
          'linear-gradient(180deg, var(--surface) 0%, var(--surface) 60%, var(--surface-elevated) 100%)',
      }}
    >
      {/* Right edge accent — matches login top rule */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-px"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, var(--primary) 40%, var(--secondary) 60%, transparent 100%)',
          opacity: 0.35,
        }}
      />
      <div className="flex items-center gap-3">
        <SidebarHex />
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--text)]">
            AI Bug Hunter
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-subtle)]">
            v0.10 · Autonomous QA
          </div>
        </div>
      </div>
      <nav className="mt-8 space-y-0.5">
        {visible.map((e) => {
          const isActive = active === e.id;
          const Icon = e.icon;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onNavigate(e.id)}
              className={`relative flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                isActive
                  ? 'bg-[var(--primary-soft)] text-[var(--text)] shadow-[inset_0_0_20px_var(--primary-soft)]'
                  : 'text-[var(--text-muted)] hover:translate-x-0.5 hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-0 w-[3px] rounded-full"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--primary) 0%, var(--secondary) 100%)',
                    boxShadow: '0 0 8px var(--primary)',
                  }}
                />
              )}
              <Icon
                size={15}
                className={isActive ? 'text-[var(--primary)]' : 'text-[var(--text-subtle)]'}
              />
              <span className={isActive ? 'ml-0.5' : ''}>{e.label}</span>
            </button>
          );
        })}
      </nav>
      {/* Bottom brand seal */}
      <div className="pointer-events-none absolute inset-x-6 bottom-4 flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.35em] text-[var(--text-subtle)] opacity-60">
        <span className="h-px w-6" style={{ background: 'linear-gradient(90deg, transparent, var(--primary))' }} />
        <span>AI · QA</span>
        <span className="h-px w-6" style={{ background: 'linear-gradient(90deg, var(--primary), transparent)' }} />
      </div>
    </aside>
  );
}
