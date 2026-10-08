import { useLayoutEffect, useRef, useState } from 'react';
import type { UserRole } from '@ai-bug-hunter/shared';
import { IconChevronLeft, IconCommand, IconRocket } from './icons.js';
import { NAV_GROUP_LABEL, visibleEntries, type NavGroup, type ViewId } from './navigation.js';

export type { ViewId } from './navigation.js';

interface Props {
  active: ViewId;
  onNavigate: (id: ViewId) => void;
  role: UserRole;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Mobile drawer state. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenTour: () => void;
  onOpenPalette: () => void;
}

const GROUP_ORDER: NavGroup[] = ['overview', 'build', 'analyze', 'system'];

/**
 * Sidebar brand mark — miniature of the login BrandMark hex logo so the
 * shell reads as the same product.
 */
function SidebarHex(): JSX.Element {
  return (
    <div className="relative shrink-0" style={{ perspective: 500 }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
        style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)', opacity: 0.5 }}
      />
      <svg
        width={30}
        height={30}
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
        className="abh-spin-slow relative drop-shadow-[0_4px_10px_rgba(124,58,237,0.35)]"
        style={{ animationDuration: '30s' }}
      >
        <defs>
          <linearGradient id="sb-hex-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="sb-hex-stroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.5" />
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
          <circle cx={36} cy={58} r={4} fill="var(--secondary)" />
          <circle cx={64} cy={58} r={4} fill="var(--secondary)" />
        </g>
      </svg>
    </div>
  );
}

export function Sidebar({
  active,
  onNavigate,
  role,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  onOpenTour,
  onOpenPalette,
}: Props): JSX.Element {
  const entries = visibleEntries(role);
  const navRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  // Slide a single highlight to the active item instead of swapping backgrounds.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const el = nav.querySelector<HTMLElement>(`[data-nav-id="${active}"]`);
    if (!el) {
      setIndicator(null);
      return;
    }
    setIndicator({ top: el.offsetTop, height: el.offsetHeight });
  }, [active, collapsed, entries.length]);

  const wide = !collapsed || mobileOpen;

  return (
    <>
      {mobileOpen && (
        <div
          aria-hidden
          onClick={onCloseMobile}
          className="abh-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-[width,transform] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${wide ? 'w-64' : 'w-[76px]'}`}
        style={{
          backgroundImage:
            'radial-gradient(400px 300px at 0% 0%, var(--primary-soft), transparent 70%), linear-gradient(180deg, var(--surface) 0%, var(--surface-elevated) 100%)',
        }}
        aria-label="Main navigation"
      >
        {/* Right edge accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-px"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, var(--primary) 40%, var(--secondary) 60%, transparent 100%)',
            opacity: 0.35,
          }}
        />

        <div className={`flex items-center gap-3 px-5 pb-2 pt-6 ${wide ? '' : 'justify-center px-0'}`}>
          <SidebarHex />
          {wide && (
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--text)]">
                AI Bug Hunter
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                Autonomous QA
              </div>
            </div>
          )}
        </div>

        {wide && (
          <button
            type="button"
            onClick={onOpenPalette}
            className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-left text-xs text-[var(--text-subtle)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-muted)]"
          >
            <IconCommand size={13} />
            <span className="flex-1">Jump to…</span>
            <span className="abh-kbd">⌘K</span>
          </button>
        )}

        <div ref={navRef} className="relative mt-4 flex-1 overflow-y-auto px-3 pb-4">
          {indicator && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 right-3 rounded-xl border border-[var(--border-strong)] transition-all duration-300 ease-out"
              style={{
                top: indicator.top,
                height: indicator.height,
                background: 'linear-gradient(90deg, var(--primary-soft), transparent)',
                boxShadow: 'inset 0 0 24px -12px var(--primary)',
              }}
            >
              <span
                className="absolute inset-y-2 left-0 w-[3px] rounded-full"
                style={{
                  background: 'linear-gradient(180deg, var(--primary) 0%, var(--secondary) 100%)',
                  boxShadow: '0 0 10px var(--primary)',
                }}
              />
            </span>
          )}

          {GROUP_ORDER.map((group) => {
            const groupEntries = entries.filter((e) => e.group === group);
            if (groupEntries.length === 0) return null;
            return (
              <div key={group} className="mb-3">
                {wide ? (
                  <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-subtle)]">
                    {NAV_GROUP_LABEL[group]}
                  </div>
                ) : (
                  <div aria-hidden className="mx-auto my-2 h-px w-6 bg-[var(--border)]" />
                )}
                <div className="space-y-0.5">
                  {groupEntries.map((e) => {
                    const isActive = active === e.id;
                    const Icon = e.icon;
                    return (
                      <button
                        key={e.id}
                        data-nav-id={e.id}
                        type="button"
                        onClick={() => {
                          onNavigate(e.id);
                          onCloseMobile();
                        }}
                        title={wide ? undefined : `${e.label} — ${e.blurb}`}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                          wide ? '' : 'justify-center'
                        } ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}`}
                      >
                        <span
                          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
                            isActive
                              ? 'text-white shadow-[0_6px_16px_-6px_var(--primary)]'
                              : 'bg-[var(--surface-hover)] text-[var(--text-subtle)] group-hover:scale-105 group-hover:text-[var(--primary-strong)]'
                          }`}
                          style={
                            isActive
                              ? { background: 'linear-gradient(135deg, var(--primary), #6d28d9)' }
                              : undefined
                          }
                        >
                          <Icon size={15} />
                          {e.step !== undefined && (
                            <span
                              className={`absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold ${
                                isActive
                                  ? 'bg-[var(--secondary)] text-[#05060b]'
                                  : 'border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-subtle)]'
                              }`}
                            >
                              {e.step}
                            </span>
                          )}
                        </span>
                        {wide && (
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{e.label}</span>
                            <span className="block truncate text-[11px] text-[var(--text-subtle)]">
                              {e.blurb}
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className={`border-t border-[var(--border)] p-3 ${wide ? '' : 'flex flex-col items-center gap-2'}`}>
          <button
            type="button"
            onClick={onOpenTour}
            title="Quick start guide"
            className={`group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[var(--surface-hover)] ${
              wide ? '' : 'justify-center'
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary-soft)] text-[var(--secondary)] transition-transform group-hover:-rotate-12">
              <IconRocket size={15} />
            </span>
            {wide && (
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--text)]">Quick start guide</span>
                <span className="block text-[11px] text-[var(--text-subtle)]">How the workflow fits together</span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`mt-1 hidden w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-[var(--text-subtle)] transition-colors hover:text-[var(--text)] lg:flex ${
              wide ? '' : 'justify-center'
            }`}
          >
            <IconChevronLeft
              size={14}
              className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
            />
            {wide && 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  );
}
