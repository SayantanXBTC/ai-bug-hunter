import type { AuthUser } from '@ai-bug-hunter/shared';
import { ThemeToggle } from './ThemeToggle.js';

interface TopBarProps {
  user: AuthUser;
  onLogout: () => void;
}

export function TopBar({ user, onLogout }: TopBarProps): JSX.Element {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3 backdrop-blur">
      <div className="text-sm font-medium tracking-wide text-[var(--text)]">AI Bug Hunter</div>
      <div className="flex items-center gap-3 text-sm">
        <ThemeToggle />
        <span className="hidden text-[var(--text-muted)] sm:inline">{user.email}</span>
        <span className="inline-flex items-center rounded border border-[var(--border-strong)] bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          {user.role}
        </span>
        <button
          type="button"
          onClick={onLogout}
          className="rounded border border-[var(--border)] px-3 py-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
