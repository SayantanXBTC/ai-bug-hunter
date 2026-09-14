import { useEffect, useState } from 'react';
import { Sidebar, type ViewId } from './components/Sidebar.js';
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
import { TopBar } from './components/shared/TopBar.js';
import { useAuth } from './hooks/useAuth.js';
import { useTheme } from './lib/theme.js';

export function App(): JSX.Element {
  const auth = useAuth();
  // Ensure the theme attribute is applied globally.
  useTheme();
  const [view, setView] = useState<ViewId>('dashboard');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [entered, setEntered] = useState(false);

  // Reset gate on logout so the user returns to the landing page.
  useEffect(() => {
    if (!auth.user) {
      setEntered(false);
      setShowLogin(false);
    }
  }, [auth.user]);

  if (auth.loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">Loading…</div>;
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

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar active={view} onNavigate={setView} role={role} />
      <div className="flex flex-1 flex-col">
        <TopBar
          user={auth.user}
          onLogout={() => void auth.logout()}
          onNavigate={(v, id) => {
            if (v === 'test-runs' && id) setSelectedRunId(id);
            setView(v as typeof view);
          }}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'dashboard' && (
            <PageShell>
              <Dashboard onNavigate={(t) => setView(t)} />
            </PageShell>
          )}
          {view === 'applications' && (
            <PageShell>
              <ApplicationsView role={role} onNavigateToTests={() => setView('tests')} />
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
                onNavigateToApplications={() => setView('applications')}
              />
            </PageShell>
          )}
          {view === 'test-runs' && (
            <PageShell>
              {selectedRunId ? (
                <TestRunDetail id={selectedRunId} onClose={() => setSelectedRunId(null)} />
              ) : (
                <TestRunList onSelect={setSelectedRunId} />
              )}
            </PageShell>
          )}
          {view === 'bugs' && (
            <PageShell>
              <BugIntelligence />
            </PageShell>
          )}
          {view === 'reliability' && (
            <PageShell>
              <TestReliability />
            </PageShell>
          )}
          {view === 'regression' && (
            <PageShell>
              <RegressionCampaigns />
            </PageShell>
          )}
          {view === 'settings' && (
            <PageShell>
              <SettingsView user={auth.user} onLogout={() => void auth.logout()} />
            </PageShell>
          )}
        </main>
      </div>
    </div>
  );
}
