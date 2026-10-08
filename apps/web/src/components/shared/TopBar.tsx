import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthUser } from '@ai-bug-hunter/shared';
import { ThemeToggle } from './ThemeToggle.js';
import { NotificationsPanel } from './NotificationsPanel.js';
import { IconChevronDown, IconChevronRight, IconCog, IconHelp, IconLogout, IconMenu, IconSearch } from '../icons.js';
import { NAV_GROUP_LABEL, entryFor, type ViewId } from '../navigation.js';

interface TopBarProps {
  user: AuthUser;
  view: ViewId;
  onLogout: () => void;
  onNavigate?: (view: string, id?: string) => void;
  onOpenPalette: () => void;
  onOpenTour: () => void;
  onOpenMobileNav: () => void;
}

export function initialsFrom(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const a = parts[0][0] ?? '';
    const b = parts[1][0] ?? '';
    return (a + b).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

const ROLE_LABEL: Record<AuthUser['role'], string> = {
  admin: 'Admin',
  qa_engineer: 'QA Engineer',
  viewer: 'Viewer',
};

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

/** Close a popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void, refs: Array<React.RefObject<HTMLElement>>): void {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (refs.every((r) => !r.current?.contains(e.target as Node))) close();
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, refs]);
}

const iconBtn =
  'relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-muted)] transition-all hover:-translate-y-px hover:border-[var(--border-strong)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]';

export function TopBar({
  user,
  view,
  onLogout,
  onNavigate,
  onOpenPalette,
  onOpenTour,
  onOpenMobileNav,
}: TopBarProps): JSX.Element {
  const initials = initialsFrom(user.email);
  const entry = entryFor(view);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState<number>(0);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeNotif = useCallback(() => setNotifOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const notifRefs = useRef([panelRef, bellRef] as Array<React.RefObject<HTMLElement>>).current;
  const menuRefs = useRef([menuRef, menuBtnRef] as Array<React.RefObject<HTMLElement>>).current;
  useDismiss(notifOpen, closeNotif, notifRefs);
  useDismiss(menuOpen, closeMenu, menuRefs);

  const handleNotificationsLoaded = useCallback((count: number) => {
    setUnread(count);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] px-4 backdrop-blur-xl sm:px-6"
      style={{ background: 'var(--surface-glass)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--primary) 40%, var(--secondary) 60%, transparent 100%)',
          opacity: 0.15,
        }}
      />

      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onOpenMobileNav} aria-label="Open navigation" className={`${iconBtn} lg:hidden`}>
          <IconMenu size={16} />
        </button>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
            <li className="hidden sm:block">{NAV_GROUP_LABEL[entry.group]}</li>
            <li aria-hidden className="hidden sm:block">
              <IconChevronRight size={11} />
            </li>
            <li className="truncate font-medium text-[var(--text)]" aria-current="page">
              {entry.step !== undefined && (
                <span className="mr-1.5 rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary-strong)]">
                  Step {entry.step}
                </span>
              )}
              {entry.label}
            </li>
          </ol>
        </nav>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={onOpenPalette}
          className="hidden h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-subtle)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-muted)] md:inline-flex"
        >
          <IconSearch size={14} />
          <span className="w-32 text-left lg:w-44">Search pages & actions</span>
          <span className="abh-kbd">⌘K</span>
        </button>
        <button type="button" onClick={onOpenPalette} aria-label="Search" className={`${iconBtn} md:hidden`}>
          <IconSearch size={15} />
        </button>
        <button type="button" onClick={onOpenTour} aria-label="Quick start guide" title="Quick start guide" className={`${iconBtn} hidden sm:inline-flex`}>
          <IconHelp size={16} />
        </button>
        <ThemeToggle />
        <div className="relative">
          <button
            ref={bellRef}
            type="button"
            aria-label={notifOpen ? 'Close notifications' : 'Open notifications'}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            onClick={() => setNotifOpen((v) => !v)}
            className={iconBtn}
          >
            <BellIcon />
            {unread > 0 && (
              <span
                aria-hidden
                className="abh-pulse-ring absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-semibold text-white"
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
              className="abh-scale-in absolute right-0 top-11 z-50 w-[min(380px,calc(100vw-2rem))]"
            >
              <NotificationsPanel
                onNavigate={(v, id) => {
                  setNotifOpen(false);
                  onNavigate?.(v, id);
                }}
                onLoaded={handleNotificationsLoaded}
              />
            </div>
          )}
        </div>

        <div className="relative">
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] pl-1 pr-2 transition-all hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold uppercase tracking-wider text-white"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
            >
              {initials}
            </span>
            <span className="hidden text-left leading-tight xl:block">
              <span className="block max-w-[160px] truncate text-xs text-[var(--text)]">{user.email}</span>
              <span className="block text-[10px] uppercase tracking-wider text-[var(--primary-strong)]">
                {ROLE_LABEL[user.role]}
              </span>
            </span>
            <IconChevronDown
              size={13}
              className={`text-[var(--text-subtle)] transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              className="abh-card abh-scale-in absolute right-0 top-11 z-50 w-64 overflow-hidden p-1.5"
              style={{ background: 'var(--surface-elevated)' }}
            >
              <div className="px-3 py-2.5">
                <div className="truncate text-sm text-[var(--text)]">{user.email}</div>
                <div className="mt-1 inline-flex rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--primary-strong)]">
                  {ROLE_LABEL[user.role]}
                </div>
              </div>
              <div className="my-1 h-px bg-[var(--border)]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate?.('settings');
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                <IconCog size={14} /> Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenTour();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                <IconHelp size={14} /> Quick start guide
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]"
              >
                <IconLogout size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
