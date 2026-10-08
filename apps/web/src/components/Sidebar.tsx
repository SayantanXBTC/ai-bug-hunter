import { useLayoutEffect, useRef, useState } from 'react';
import type { UserRole } from '@ai-bug-hunter/shared';
import { IconChevronLeft, IconRocket } from './icons.js';
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
        } ${wide ? 'w-60' : 'w-[72px]'}`}
        style={{
          background: 'var(--surface)',
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
            opacity: 0.12,
          }}
        />

        <div className={`flex items-center gap-3 px-5 pb-2 pt-5 ${wide ? '' : 'justify-center px-0'}`}>
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

        <div ref={navRef} className="relative mt-5 flex-1 overflow-y-auto px-3 pb-4">
          {indicator && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 right-3 rounded-lg transition-all duration-300 ease-out"
              style={{
                top: indicator.top,
                height: indicator.height,
                background: 'var(--primary-soft)',
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
              <div key={group} className="mb-2">
                {wide ? (
                  <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--text-subtle)]">
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
                        title={`${e.label} — ${e.blurb}`}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                          wide ? '' : 'justify-center'
                        } ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}`}
                      >
                        <span
                          className={`relative flex h-7 w-7 shrink-0 items-center justify-center transition-colors duration-200 ${
                            isActive ? 'text-[var(--primary-strong)]' : 'text-[var(--text-subtle)] group-hover:text-[var(--text)]'
                          }`}
                        >
                          <Icon size={16} />
                        </span>
                        {wide && (
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-medium">{e.label}</span>
                            {e.step !== undefined && (
                              <span className="text-[10px] tabular-nums text-[var(--text-subtle)]">0{e.step}</span>
                            )}
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

        <div className={`border-t border-[var(--border)] p-3 ${wide ? '' : 'flex flex-col items-center'}`}>
          <button
            type="button"
            onClick={onOpenTour}
            title="Quick start guide"
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)] ${
              wide ? '' : 'justify-center'
            }`}
          >
            <IconRocket size={15} className="shrink-0" />
            {wide && 'Quick start guide'}
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`mt-0.5 hidden w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)] lg:flex ${
              wide ? '' : 'justify-center'
            }`}
          >
            <IconChevronLeft
              size={15}
              className={`shrink-0 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
            />
            {wide && 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  );
}
