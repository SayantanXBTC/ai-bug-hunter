import { useState } from 'react';
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
import { PageShell } from './components/shared/PageShell.js';
import { TopBar } from './components/shared/TopBar.js';
import { useAuth } from './hooks/useAuth.js';
import { useTheme } from './lib/theme.js';

const DARK_VIEWS: ReadonlySet<ViewId> = new Set(['test-runs', 'bugs', 'reliability']);

export function App(): JSX.Element {
  const auth = useAuth();
  // Ensure the theme attribute is applied globally.
  useTheme();
  const [view, setView] = useState<ViewId>('dashboard');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (auth.loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading…</div>;
  }
  if (!auth.user) {
    return <LoginView onAuthenticated={() => void auth.refresh()} />;
  }

  const role = auth.user.role;
  const isDark = DARK_VIEWS.has(view);

  return (
    <div className={`flex min-h-screen ${isDark ? 'bg-[#05060B] text-white/90' : 'bg-[var(--bg)] text-[var(--text)]'}`}>
      <Sidebar active={view} onNavigate={setView} role={role} />
      <div className="flex flex-1 flex-col">
        <TopBar user={auth.user} onLogout={() => void auth.logout()} />
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'dashboard' && <Dashboard onNavigate={(t) => setView(t)} />}
          {view === 'applications' && (
            <ApplicationsView role={role} onNavigateToTests={() => setView('tests')} />
          )}
          {view === 'tests' && (
            <TestsView
              role={role}
              onNavigateToRun={(runId) => {
                setSelectedRunId(runId);
                setView('test-runs');
              }}
              onNavigateToApplications={() => setView('applications')}
            />
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
          {view === 'regression' && <RegressionCampaigns />}
          {view === 'settings' && (
            <SettingsView user={auth.user} onLogout={() => void auth.logout()} />
          )}
        </main>
      </div>
    </div>
  );
}
