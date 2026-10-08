import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { UserRole } from '@ai-bug-hunter/shared';
import { visibleEntries, type PageAction, type ViewId } from '../navigation.js';
import {
  IconBug,
  IconChevronRight,
  IconLogout,
  IconPalette,
  IconPlus,
  IconRocket,
  IconSearch,
  IconSparkles,
  IconTarget,
} from '../icons.js';

interface Props {
  open: boolean;
  role: UserRole;
  onClose: () => void;
  onNavigate: (view: ViewId, action?: PageAction) => void;
  onToggleTheme: () => void;
  onOpenTour: () => void;
  onLogout: () => void;
}

interface Command {
  id: string;
  label: string;
  hint: string;
  section: 'Actions' | 'Pages' | 'General';
  keywords: string;
  icon: ReactNode;
  run: () => void;
}

export function CommandPalette({
  open,
  role,
  onClose,
  onNavigate,
  onToggleTheme,
  onOpenTour,
  onLogout,
}: Props): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const canWrite = role === 'admin' || role === 'qa_engineer';

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (canWrite) {
      list.push(
        {
          id: 'a-add',
          label: 'Add an application',
          hint: 'Register a URL to test',
          section: 'Actions',
          keywords: 'new app url register create',
          icon: <IconPlus size={15} />,
          run: () => onNavigate('applications', 'add-application'),
        },
        {
          id: 'a-gen',
          label: 'Generate tests with AI',
          hint: 'Create a test suite from a discovered app',
          section: 'Actions',
          keywords: 'ai create suite claude',
          icon: <IconSparkles size={15} />,
          run: () => onNavigate('tests', 'generate-tests'),
        },
        {
          id: 'a-camp',
          label: 'Create a regression campaign',
          hint: 'Batch-run tests for one verdict',
          section: 'Actions',
          keywords: 'regression batch run campaign',
          icon: <IconTarget size={15} />,
          run: () => onNavigate('regression', 'create-campaign'),
        },
      );
    }
    list.push({
      id: 'a-analyze',
      label: 'Analyze failures',
      hint: 'Cluster failed runs into bugs',
      section: 'Actions',
      keywords: 'bugs cluster ai investigate',
      icon: <IconBug size={15} />,
      run: () => onNavigate('bugs', 'analyze-bugs'),
    });
    for (const e of visibleEntries(role)) {
      const Icon = e.icon;
      list.push({
        id: `p-${e.id}`,
        label: e.label,
        hint: e.blurb,
        section: 'Pages',
        keywords: `${e.guide.summary} go open page`,
        icon: <Icon size={15} />,
        run: () => onNavigate(e.id),
      });
    }
    list.push(
      {
        id: 'g-theme',
        label: 'Toggle dark / light mode',
        hint: 'Switch theme',
        section: 'General',
        keywords: 'theme dark light appearance',
        icon: <IconPalette size={15} />,
        run: onToggleTheme,
      },
      {
        id: 'g-tour',
        label: 'Open quick start guide',
        hint: 'How the workflow fits together',
        section: 'General',
        keywords: 'help tour onboarding guide',
        icon: <IconRocket size={15} />,
        run: onOpenTour,
      },
      {
        id: 'g-logout',
        label: 'Log out',
        hint: 'End this session',
        section: 'General',
        keywords: 'sign out exit',
        icon: <IconLogout size={15} />,
        run: onLogout,
      },
    );
    return list;
  }, [canWrite, role, onNavigate, onToggleTheme, onOpenTour, onLogout]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const terms = q.split(/\s+/);
    return commands.filter((c) => {
      const hay = `${c.label} ${c.hint} ${c.keywords}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const runAt = (i: number): void => {
    const cmd = filtered[i];
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  let lastSection = '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="abh-fade-in fixed inset-0 z-[60] flex items-start justify-center bg-black/55 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="abh-card abh-scale-in w-full max-w-xl overflow-hidden"
        style={{ background: 'var(--surface-elevated)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCursor((c) => Math.min(filtered.length - 1, c + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor((c) => Math.max(0, c - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            runAt(cursor);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
          <IconSearch size={16} className="text-[var(--primary-strong)]" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a page or action…"
            aria-label="Search commands"
            className="h-14 flex-1 bg-transparent text-[15px] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none"
          />
          <span className="abh-kbd">Esc</span>
        </div>
        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-[var(--text-subtle)]">
              Nothing matches &quot;{query}&quot;.
            </li>
          )}
          {filtered.map((c, i) => {
            const header = c.section !== lastSection ? c.section : null;
            lastSection = c.section;
            const active = i === cursor;
            return (
              <li key={c.id} role="option" aria-selected={active}>
                {header && (
                  <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  data-idx={i}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => runAt(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-[var(--primary-soft)]' : ''
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      active ? 'text-white' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
                    }`}
                    style={active ? { background: 'linear-gradient(135deg, var(--primary), var(--secondary))' } : undefined}
                  >
                    {c.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[var(--text)]">{c.label}</span>
                    <span className="block truncate text-xs text-[var(--text-subtle)]">{c.hint}</span>
                  </span>
                  <IconChevronRight
                    size={14}
                    className={`transition-all ${active ? 'translate-x-0 text-[var(--primary-strong)] opacity-100' : '-translate-x-1 opacity-0'}`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--text-subtle)]">
          <span className="flex items-center gap-1">
            <span className="abh-kbd">↑</span>
            <span className="abh-kbd">↓</span> move
          </span>
          <span className="flex items-center gap-1">
            <span className="abh-kbd">↵</span> open
          </span>
          <span className="ml-auto">AI Bug Hunter</span>
        </div>
      </div>
    </div>
  );
}
