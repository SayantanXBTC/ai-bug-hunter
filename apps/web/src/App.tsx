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
import { PageErrorBoundary } from './components/shared/PageErrorBoundary.js';
import type { PageAction, ViewId } from './components/navigation.js';
import { useAuth } from './hooks/useAuth.js';
import { useTheme } from './lib/theme.js';
import { useStoredFlag } from './lib/motion.js';
import { useHashRoute } from './lib/router.js';

export function App(): JSX.Element {
  const auth = useAuth();
  // Ensure the theme attribute is applied globally.
  const { toggle: toggleTheme } = useTheme();
  const { route, navigate } = useHashRoute();
  const [pendingAction, setPendingAction] = useState<PageAction | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useStoredFlag('abh-sidebar-collapsed', false);
  const [tourSeen, setTourSeen] = useStoredFlag('abh-tour-seen', false);

  const entered = route.screen === 'app';
  const view: ViewId = route.screen === 'app' ? route.view : 'dashboard';
  const detailId = route.screen === 'app' ? route.id : null;

  // Guard routes against auth state: app pages need a session, the login
  // page does not make sense with one. `replace` keeps Back history clean.
  useEffect(() => {
    if (auth.loading) return;
    if (route.screen === 'app' && !auth.user) navigate({ screen: 'landing' }, { replace: true });
    if (route.screen === 'login' && auth.user)
      navigate({ screen: 'app', view: 'dashboard', id: null }, { replace: true });
  }, [auth.loading, auth.user, route.screen, navigate]);

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

  // Close overlays when the user goes Back/Forward.
  useEffect(() => {
    setMobileNavOpen(false);
    setPaletteOpen(false);
    window.scrollTo({ top: 0 });
  }, [route]);

  const go = useCallback(
    (next: ViewId, action?: PageAction) => {
      setPendingAction(action ?? null);
      navigate({ screen: 'app', view: next, id: null });
    },
    [navigate],
  );

  /** Open or close a detail inside the current page (adds a Back step). */
  const openDetail = useCallback(
    (v: ViewId, id: string | null) => navigate({ screen: 'app', view: v, id }),
    [navigate],
  );

  const consumeAction = useCallback(() => setPendingAction(null), []);

  const logout = useCallback(async () => {
    await auth.logout();
    navigate({ screen: 'landing' }, { replace: true });
  }, [auth, navigate]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    setTourSeen(true);
  }, [setTourSeen]);

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)]"
          style={{ borderTopColor: 'var(--primary)' }}
        />
      </div>
    );
  }

  if (route.screen === 'login' && !auth.user) {
    return (
      <LoginView
        onAuthenticated={() => {
          // Wait for the session before switching, or the route guard would
          // see "no user" and bounce back. Replace the login entry so Back
          // from the dashboard goes to the landing page.
          void auth
            .refresh()
            .then(() =>
              navigate({ screen: 'app', view: 'dashboard', id: null }, { replace: true }),
            );
        }}
      />
    );
  }

  if (!entered || !auth.user) {
    return (
      <LandingPage
        isAuthenticated={!!auth.user}
        onCta={() => {
          if (auth.user) navigate({ screen: 'app', view: 'dashboard', id: null });
          else navigate({ screen: 'login' });
        }}
      />
    );
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
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={auth.user}
          view={view}
          onLogout={() => void logout()}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenTour={() => setTourOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onNavigate={(v, id) => {
            if (v === 'test-runs' && id) {
              openDetail('test-runs', id);
              return;
            }
            go(v as ViewId);
          }}
        />
        <main className="min-w-0 flex-1 overflow-x-clip">
          <PageErrorBoundary key={`${view}/${detailId ?? ''}`}>
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
                    detailId={detailId}
                    onDetailChange={(id) => openDetail('applications', id)}
                  />
                </PageShell>
              )}
              {view === 'tests' && (
                <PageShell>
                  <TestsView
                    role={role}
                    onNavigateToRun={(runId) => openDetail('test-runs', runId)}
                    onNavigateToApplications={() => go('applications')}
                    openGenerateOnMount={pendingAction === 'generate-tests'}
                    onActionConsumed={consumeAction}
                    detailId={detailId}
                    onDetailChange={(id) => openDetail('tests', id)}
                  />
                </PageShell>
              )}
              {view === 'test-runs' && (
                <PageShell>
                  {detailId ? (
                    <TestRunDetail id={detailId} onClose={() => openDetail('test-runs', null)} />
                  ) : (
                    <TestRunList
                      onSelect={(id) => openDetail('test-runs', id)}
                      onNavigateToTests={canWrite ? () => go('tests') : undefined}
                    />
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
                    onLogout={() => void logout()}
                    onOpenTour={() => setTourOpen(true)}
                  />
                </PageShell>
              )}
            </div>
          </PageErrorBoundary>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        role={role}
        onClose={() => setPaletteOpen(false)}
        onNavigate={go}
        onToggleTheme={toggleTheme}
        onOpenTour={() => setTourOpen(true)}
        onLogout={() => void logout()}
      />
      <WelcomeTour open={tourOpen} canWrite={canWrite} onClose={closeTour} onGo={go} />
    </div>
  );
}
