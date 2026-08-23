import type { AuthUser } from '@ai-bug-hunter/shared';
import { ThemeToggle } from './ThemeToggle.js';

interface TopBarProps {
  user: AuthUser;
  onLogout: () => void;
}

function initialsFrom(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const a = parts[0][0] ?? '';
    const b = parts[1][0] ?? '';
    return (a + b).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function BellIcon(): JSX.Element {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function TopBar({ user, onLogout }: TopBarProps): JSX.Element {
  const initials = initialsFrom(user.email);
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 backdrop-blur">
      <div className="text-sm font-medium tracking-wide text-[var(--text)]">
        AI Bug Hunter
      </div>
      <div className="flex items-center gap-2.5 text-sm">
        <ThemeToggle />
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <BellIcon />
        </button>
        <div className="flex items-center gap-2 pl-1">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[11px] font-semibold uppercase tracking-wider text-[var(--primary)]"
          >
            {initials}
          </span>
          <span className="hidden text-[var(--text-muted)] sm:inline">{user.email}</span>
        </div>
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
