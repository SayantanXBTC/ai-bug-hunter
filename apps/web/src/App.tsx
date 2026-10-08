import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { TestRunList } from './components/TestRunList.js';
import { TestRunDetail } from './components/TestRunDetail.js';
import { TestsView } from './components/tests/TestsView.js';
import { ApplicationsView } from './components/applications/ApplicationsView.js';
import { BugIntelligence } from './components/BugIntelligence.js';
import { TestReliability } from './components/TestReliability.js';
import { RegressionCampaigns } from './components/RegressionCampaigns.js';
import { Dashboard } from './components/Dashboard.js';
import { SettingsView } from './components/SettingsView.js';
import { LoginView } from './components/LoginView.js';
import { LandingPage } from './components/LandingPage.js';
import { PageShell } from './components/shared/PageShell.js';
import { PageAmbient } from './components/shared/PageAmbient.js';
import { TopBar } from './components/shared/TopBar.js';
import { CommandPalette } from './components/shared/CommandPalette.js';
import { WelcomeTour } from './components/shared/WelcomeTour.js';
import type { PageAction, ViewId } from './components/navigation.js';
import { useAuth } from './hooks/useAuth.js';
import { useTheme } from './lib/theme.js';
import { useStoredFlag } from './lib/motion.js';

export function App(): JSX.Element {
  const auth = useAuth();
  // Ensure the theme attribute is applied globally.
  const { toggle: toggleTheme } = useTheme();
  const [view, setView] = useState<ViewId>('dashboard');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [entered, setEntered] = useState(false);
  const [pendingAction, setPendingAction] = useState<PageAction | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useStoredFlag('abh-sidebar-collapsed', false);
  const [tourSeen, setTourSeen] = useStoredFlag('abh-tour-seen', false);

  // Reset gate on logout so the user returns to the landing page.
  useEffect(() => {
    if (!auth.user) {
      setEntered(false);
      setShowLogin(false);
    }
  }, [auth.user]);

  // First visit after sign-in: show the quick start guide once.
  useEffect(() => {
    if (entered && auth.user && !tourSeen) {
      const t = setTimeout(() => setTourOpen(true), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [entered, auth.user, tourSeen]);

  // ⌘K / Ctrl+K opens the command palette.
  useEffect(() => {
    if (!entered) return;
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entered]);

  const go = useCallback((next: ViewId, action?: PageAction) => {
    if (next === 'test-runs') setSelectedRunId(null);
    setView(next);
    setPendingAction(action ?? null);
    window.scrollTo({ top: 0 });
  }, []);

  const consumeAction = useCallback(() => setPendingAction(null), []);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    setTourSeen(true);
  }, [setTourSeen]);

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-4">
          <span
            className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)]"
            style={{ borderTopColor: 'var(--primary)' }}
          />
          <span className="text-xs uppercase tracking-[0.3em] text-[var(--text-subtle)]">Loading</span>
        </div>
      </div>
    );
  }

  if (!entered) {
    if (showLogin && !auth.user) {
      return (
        <LoginView
          onAuthenticated={() => {
            void auth.refresh();
            setShowLogin(false);
            setEntered(true);
          }}
        />
      );
    }
    return (
      <LandingPage
        isAuthenticated={!!auth.user}
        onCta={() => {
          if (auth.user) setEntered(true);
          else setShowLogin(true);
        }}
      />
    );
  }

  if (!auth.user) {
    // Effect above will reset `entered`; render placeholder during transition.
    return <div className="min-h-screen bg-[var(--bg)]" />;
  }

  const role = auth.user.role;
  const canWrite = role === 'admin' || role === 'qa_engineer';

  return (
    <div className="flex min-h-screen text-[var(--text)]">
      <PageAmbient />
      <Sidebar
        active={view}
        onNavigate={(v) => go(v)}
        role={role}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onOpenTour={() => setTourOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={auth.user}
          view={view}
          onLogout={() => void auth.logout()}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenTour={() => setTourOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onNavigate={(v, id) => {
            if (v === 'test-runs' && id) {
              setSelectedRunId(id);
              setView('test-runs');
              return;
            }
            go(v as ViewId);
          }}
        />
        <main className="min-w-0 flex-1 overflow-x-clip">
          <div key={view} className="abh-fade-up">
            {view === 'dashboard' && (
              <PageShell>
                <Dashboard onNavigate={(t, action) => go(t, action)} />
              </PageShell>
            )}
            {view === 'applications' && (
              <PageShell>
                <ApplicationsView
                  role={role}
                  onNavigateToTests={() => go('tests')}
                  openAddOnMount={pendingAction === 'add-application'}
                  onActionConsumed={consumeAction}
                />
              </PageShell>
            )}
            {view === 'tests' && (
              <PageShell>
                <TestsView
                  role={role}
                  onNavigateToRun={(runId) => {
                    setSelectedRunId(runId);
                    setView('test-runs');
                  }}
                  onNavigateToApplications={() => go('applications')}
                  openGenerateOnMount={pendingAction === 'generate-tests'}
                  onActionConsumed={consumeAction}
                />
              </PageShell>
            )}
            {view === 'test-runs' && (
              <PageShell>
                {selectedRunId ? (
                  <TestRunDetail id={selectedRunId} onClose={() => setSelectedRunId(null)} />
                ) : (
                  <TestRunList onSelect={setSelectedRunId} onNavigateToTests={canWrite ? () => go('tests') : undefined} />
                )}
              </PageShell>
            )}
            {view === 'bugs' && (
              <PageShell>
                <BugIntelligence
                  analyzeOnMount={pendingAction === 'analyze-bugs'}
                  onActionConsumed={consumeAction}
                  onNavigateToRuns={() => go('test-runs')}
                />
              </PageShell>
            )}
            {view === 'reliability' && (
              <PageShell>
                <TestReliability onNavigateToTests={canWrite ? () => go('tests') : undefined} />
              </PageShell>
            )}
            {view === 'regression' && (
              <PageShell>
                <RegressionCampaigns
                  openCreateOnMount={pendingAction === 'create-campaign'}
                  onActionConsumed={consumeAction}
                />
              </PageShell>
            )}
            {view === 'settings' && (
              <PageShell>
                <SettingsView
                  user={auth.user}
                  onLogout={() => void auth.logout()}
                  onOpenTour={() => setTourOpen(true)}
                />
              </PageShell>
            )}
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        role={role}
        onClose={() => setPaletteOpen(false)}
        onNavigate={go}
        onToggleTheme={toggleTheme}
        onOpenTour={() => setTourOpen(true)}
        onLogout={() => void auth.logout()}
      />
      <WelcomeTour open={tourOpen} canWrite={canWrite} onClose={closeTour} onGo={go} />
    </div>
  );
}
