import type { UserRole } from '@ai-bug-hunter/shared';
import { IconHexLogo } from './icons.js';

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
}

const ENTRIES: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'applications', label: 'Applications' },
  { id: 'tests', label: 'Tests', minRole: 'qa_engineer' },
  { id: 'test-runs', label: 'Test Runs' },
  { id: 'bugs', label: 'Bugs' },
  { id: 'reliability', label: 'Reliability' },
  { id: 'regression', label: 'Regression' },
  { id: 'settings', label: 'Settings' },
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
    <aside className="w-60 shrink-0 border-r border-white/[0.06] bg-[#08090F] p-6 text-neutral-300">
      <div className="flex items-center gap-2">
        <span className="text-violet-400">
          <IconHexLogo size={22} />
        </span>
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/90">
            AI Bug Hunter
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">v0.10</div>
        </div>
      </div>
      <nav className="mt-8 space-y-0.5">
        {visible.map((e) => {
          const isActive = active === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onNavigate(e.id)}
              className={`relative block w-full rounded px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${
                isActive
                  ? 'bg-white/[0.04] text-white'
                  : 'text-neutral-400 hover:bg-white/[0.02] hover:text-neutral-200'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-violet-400"
                />
              )}
              <span className={isActive ? 'ml-1' : ''}>{e.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
