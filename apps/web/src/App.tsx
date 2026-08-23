import { useState } from 'react';
import { Sidebar, type ViewId } from './components/Sidebar.js';
import { TestRunList } from './components/TestRunList.js';
import { TestRunDetail } from './components/TestRunDetail.js';
import { Discovery } from './components/Discovery.js';
import { AiGeneration } from './components/AiGeneration.js';
import { BugIntelligence } from './components/BugIntelligence.js';
import { TestReliability } from './components/TestReliability.js';
import { RegressionCampaigns } from './components/RegressionCampaigns.js';
import { Dashboard } from './components/Dashboard.js';
import { SettingsView } from './components/SettingsView.js';
import { LoginView } from './components/LoginView.js';
import { useAuth } from './hooks/useAuth.js';

export function App(): JSX.Element {
  const auth = useAuth();
  const [view, setView] = useState<ViewId>('dashboard');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<{
    application: { id: string; baseUrl: string; discoveredAt: string; pages: Array<{ path: string }> };
  } | null>(null);

  if (auth.loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading…</div>;
  }
  if (!auth.user) {
    return <LoginView onAuthenticated={() => void auth.refresh()} />;
  }

  const role = auth.user.role;
  const canWrite = role === 'admin' || role === 'qa_engineer';

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar active={view} onNavigate={setView} role={role} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          <div className="text-sm font-medium text-slate-700">AI Bug Hunter</div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">
              {auth.user.email} <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{role}</span>
            </span>
            <button
              onClick={() => void auth.logout()}
              className="rounded border px-3 py-1 text-slate-700 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'dashboard' && <Dashboard />}
          {view === 'applications' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">Applications</h1>
              {canWrite ? (
                <Discovery onResult={(r) => setDiscoveryResult(r as never)} />
              ) : (
                <div className="rounded-lg border bg-white p-4 text-sm text-slate-500 shadow-sm">
                  You have read-only access. Ask an admin or QA engineer to register applications.
                </div>
              )}
            </div>
          )}
          {view === 'tests' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">Tests</h1>
              <AiGeneration
                applicationModel={discoveryResult?.application ?? null}
                applicationPagePaths={discoveryResult?.application.pages.map((p) => p.path) ?? []}
              />
            </div>
          )}
          {view === 'test-runs' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">Test Runs</h1>
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <TestRunList onSelect={setSelectedRunId} />
              </div>
              {selectedRunId && (
                <TestRunDetail id={selectedRunId} onClose={() => setSelectedRunId(null)} />
              )}
            </div>
          )}
          {view === 'bugs' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">Bugs</h1>
              <BugIntelligence />
            </div>
          )}
          {view === 'reliability' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">Reliability</h1>
              <TestReliability />
            </div>
          )}
          {view === 'regression' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">Regression</h1>
              <RegressionCampaigns />
            </div>
          )}
          {view === 'settings' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">Settings</h1>
              <SettingsView user={auth.user} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
