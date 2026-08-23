import type { UserRole } from '@ai-bug-hunter/shared';
import type { SVGProps } from 'react';
import {
  IconHexLogo,
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

export function Sidebar({ active, onNavigate, role }: Props): JSX.Element {
  const visible = ENTRIES.filter((e) => {
    if (!e.minRole) return true;
    return ROLE_ORDER[role] >= ROLE_ORDER[e.minRole];
  });

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text-muted)]">
      <div className="flex items-center gap-2">
        <span className="text-[var(--primary)]">
          <IconHexLogo size={22} />
        </span>
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--text)]">
            AI Bug Hunter
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-subtle)]">
            v0.10
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
              className={`relative flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                isActive
                  ? 'bg-[var(--primary-soft)] text-[var(--text)] shadow-[inset_0_0_20px_var(--primary-soft)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-[var(--primary)]"
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
    </aside>
  );
}
