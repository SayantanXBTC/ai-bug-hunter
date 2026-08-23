import type { UserRole } from '@ai-bug-hunter/shared';

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
    <aside className="w-60 shrink-0 border-r bg-white p-6">
      <div className="text-lg font-semibold text-slate-800">AI Bug Hunter</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-slate-400">Phase 10</div>
      <nav className="mt-8 space-y-1">
        {visible.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onNavigate(e.id)}
            className={`block w-full rounded px-3 py-2 text-left text-sm ${
              active === e.id
                ? 'bg-slate-800 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {e.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
