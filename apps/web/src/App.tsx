import { useState } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { StatusBadge } from './components/StatusBadge.js';
import { EmptyState } from './components/EmptyState.js';
import { TestRunList } from './components/TestRunList.js';
import { TestRunDetail } from './components/TestRunDetail.js';
import { useHealth } from './hooks/useHealth.js';

const sections = [
  {
    id: 'applications',
    title: 'Applications',
    description: 'Web applications registered for autonomous testing.',
    emptyText: 'No applications registered.',
  },
  {
    id: 'test-runs',
    title: 'Test Runs',
    description: 'Recent autonomous test execution runs.',
    emptyText: 'No test runs yet.',
  },
  {
    id: 'test-cases',
    title: 'Test Cases',
    description: 'AI-generated and curated test cases.',
    emptyText: 'No test cases yet.',
  },
  {
    id: 'bugs',
    title: 'Bugs',
    description: 'Bugs discovered and clustered by the intelligence engine.',
    emptyText: 'No bugs discovered.',
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Historical test and quality reports.',
    emptyText: 'No reports available.',
  },
] as const;

export function App(): JSX.Element {
  const health = useHealth();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar sections={sections.map((s) => ({ id: s.id, label: s.title }))} />
      <main className="flex-1 p-8 space-y-8 overflow-y-auto">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">AI Bug Hunter</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              AI-powered autonomous web application testing and bug intelligence platform.
              Phase 1 — Foundation. Testing engine, crawler, and bug intelligence layer arrive in
              later phases.
            </p>
          </div>
          <StatusBadge health={health} />
        </header>

        <section id="test-runs" className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold">Test Runs</h2>
          <p className="mt-1 mb-4 text-sm text-slate-400">
            Recent autonomous test execution runs, persisted in PostgreSQL.
          </p>
          <TestRunList onSelect={setSelectedRunId} />
        </section>

        {selectedRunId && (
          <section id="test-run-detail">
            <TestRunDetail id={selectedRunId} onClose={() => setSelectedRunId(null)} />
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections
            .filter((s) => s.id !== 'test-runs')
            .map((s) => (
              <article
                key={s.id}
                id={s.id}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-5"
              >
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{s.description}</p>
                <div className="mt-4">
                  <EmptyState text={s.emptyText} />
                </div>
              </article>
            ))}
        </section>
      </main>
    </div>
  );
}
