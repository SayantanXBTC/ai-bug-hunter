import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthUser } from '@ai-bug-hunter/shared';
import { ThemeToggle } from './ThemeToggle.js';
import { NotificationsPanel } from './NotificationsPanel.js';

interface TopBarProps {
  user: AuthUser;
  onLogout: () => void;
  onNavigate?: (view: string, id?: string) => void;
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

export function TopBar({ user, onLogout, onNavigate }: TopBarProps): JSX.Element {
  const initials = initialsFrom(user.email);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState<number>(0);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Esc
  useEffect(() => {
    if (!notifOpen) return;
    function onDown(e: MouseEvent): void {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !bellRef.current?.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setNotifOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  const handleNotificationsLoaded = useCallback((count: number) => {
    setUnread(count);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border)] px-6 backdrop-blur-md"
      style={{
        background:
          'linear-gradient(180deg, var(--surface-glass) 0%, var(--surface) 100%)',
      }}
    >
      {/* Signature top rule */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--primary) 40%, var(--secondary) 60%, transparent 100%)',
          opacity: 0.35,
        }}
      />
      <div className="flex items-center gap-2.5 text-sm font-medium tracking-wide text-[var(--text)]">
        <svg
          width={18}
          height={18}
          viewBox="0 0 100 100"
          aria-hidden="true"
          focusable="false"
          className="text-[var(--primary)]"
        >
          <polygon
            points="50,4 87,25 87,75 50,96 13,75 13,25"
            fill="var(--primary-soft)"
            stroke="currentColor"
            strokeWidth={4}
          />
          <circle cx={50} cy={50} r={10} fill="currentColor" />
        </svg>
        <span>AI Bug Hunter</span>
      </div>
      <div className="flex items-center gap-2.5 text-sm">
        <ThemeToggle />
        <div className="relative">
          <button
            ref={bellRef}
            type="button"
            aria-label={notifOpen ? 'Close notifications' : 'Open notifications'}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            onClick={() => setNotifOpen((v) => !v)}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <BellIcon />
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-semibold text-white"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Notifications"
              className="absolute right-0 top-10 z-50 w-[380px]"
            >
              <NotificationsPanel
                onNavigate={(view, id) => {
                  setNotifOpen(false);
                  onNavigate?.(view, id);
                }}
                onLoaded={handleNotificationsLoaded}
              />
            </div>
          )}
        </div>
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
