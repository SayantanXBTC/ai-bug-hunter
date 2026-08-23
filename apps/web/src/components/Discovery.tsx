import { useState } from 'react';

interface DiscoveredLink {
  text: string;
  normalizedUrl: string;
  inScope: boolean;
}

interface SelectorCandidate {
  strategy: string;
  value: string;
  confidence: number;
  unique: boolean;
}

interface DiscoveredElement {
  category: string;
  tagName: string;
  accessibleName?: string;
  role?: string;
  testId?: string;
  selectors: SelectorCandidate[];
}

interface DiscoveredFormField {
  name?: string;
  type: string;
  label?: string;
  required: boolean;
  selectors: SelectorCandidate[];
}

interface DiscoveredForm {
  method: string;
  action?: string;
  fields: DiscoveredFormField[];
  submitSelectors: SelectorCandidate[];
}

interface PageModel {
  url: string;
  path: string;
  title: string;
  headings: Array<{ level: number; text: string }>;
  links: DiscoveredLink[];
  elements: DiscoveredElement[];
  forms: DiscoveredForm[];
}

interface DiscoveryResult {
  application: {
    id: string;
    baseUrl: string;
    discoveredAt: string;
    pages: PageModel[];
  };
  stats: {
    pagesVisited: number;
    pagesDiscovered: number;
    linksFound: number;
    interactiveElements: number;
    forms: number;
    crawlDurationMs: number;
  };
  warnings: Array<{ kind: string; message: string; url?: string }>;
}

interface DiscoveryProps {
  onResult?: (r: DiscoveryResult | null) => void;
}

export function Discovery({ onResult }: DiscoveryProps = {}): JSX.Element {
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:5173');
  const [maxPages, setMaxPages] = useState(10);
  const [maxDepth, setMaxDepth] = useState(2);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [selectedPageIdx, setSelectedPageIdx] = useState<number | null>(null);

  const submit = async (): Promise<void> => {
    setRunning(true);
    setError(null);
    setResult(null);
    setSelectedPageIdx(null);
    onResult?.(null);
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseUrl, maxPages, maxDepth }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      const parsed = (await res.json()) as DiscoveryResult;
      setResult(parsed);
      onResult?.(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Discovery</h2>
        <p className="mt-1 text-sm text-slate-400">
          Deterministic crawl and structured application model.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="md:col-span-2 text-xs text-slate-400 flex flex-col">
          Target URL
          <input
            className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-400 flex flex-col">
          Max pages
          <input
            type="number"
            min={1}
            className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
          />
        </label>
        <label className="text-xs text-slate-400 flex flex-col">
          Max depth
          <input
            type="number"
            min={0}
            className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
          />
        </label>
      </div>

      <button
        onClick={submit}
        disabled={running}
        className="rounded bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-brand-500 disabled:opacity-50"
      >
        {running ? 'Discovering…' : 'Discover Application'}
      </button>

      {error && <div className="text-sm text-rose-400">{error}</div>}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            <Stat label="Pages" value={result.stats.pagesDiscovered} />
            <Stat label="Visited" value={result.stats.pagesVisited} />
            <Stat label="Links" value={result.stats.linksFound} />
            <Stat label="Elements" value={result.stats.interactiveElements} />
            <Stat label="Forms" value={result.stats.forms} />
            <Stat label="Duration" value={`${result.stats.crawlDurationMs} ms`} />
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded border border-amber-900 bg-amber-950/40 p-3 text-sm">
              <div className="font-medium text-amber-300">Warnings ({result.warnings.length})</div>
              <ul className="mt-1 text-xs text-amber-200 space-y-1 max-h-40 overflow-auto">
                {result.warnings.map((w, i) => (
                  <li key={i}>
                    <span className="uppercase tracking-wider mr-1">{w.kind}</span>
                    {w.message}
                    {w.url && <> — {w.url}</>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-800 rounded p-3">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Pages</div>
              <ul className="space-y-1 text-sm">
                {result.application.pages.map((p, i) => (
                  <li key={p.url}>
                    <button
                      onClick={() => setSelectedPageIdx(i)}
                      className={`text-left w-full px-2 py-1 rounded hover:bg-slate-800 ${
                        selectedPageIdx === i ? 'bg-slate-800' : ''
                      }`}
                    >
                      <div className="text-slate-100">{p.title || p.path}</div>
                      <div className="text-xs text-slate-500">{p.path}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2">
              {selectedPageIdx !== null && result.application.pages[selectedPageIdx] && (
                <PageDetail page={result.application.pages[selectedPageIdx]!} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageDetail({ page }: { page: PageModel }): JSX.Element {
  return (
    <div className="border border-slate-800 rounded p-3 space-y-3 text-sm">
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500">URL</div>
        <div className="text-slate-100 break-all">{page.url}</div>
      </div>

      <Section title="Headings">
        {page.headings.map((h, i) => (
          <div key={i} className="text-slate-300">
            H{h.level}: {h.text}
          </div>
        ))}
      </Section>

      <Section title={`Elements (${page.elements.length})`}>
        <div className="max-h-64 overflow-auto space-y-1">
          {page.elements.map((e, i) => (
            <div key={i} className="border-b border-slate-800 py-1">
              <div>
                <span className="text-brand-500">{e.category}</span>
                <span className="text-slate-500"> {e.tagName}</span>
                {e.accessibleName && <span className="text-slate-300"> · {e.accessibleName}</span>}
              </div>
              {e.selectors[0] && (
                <div className="text-xs text-slate-500 font-mono">
                  {e.selectors[0].strategy}: {e.selectors[0].value}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Forms (${page.forms.length})`}>
        {page.forms.map((f, i) => (
          <div key={i} className="border border-slate-800 rounded p-2 mb-2">
            <div className="text-xs text-slate-500">
              {f.method} {f.action ?? '(current)'} · {f.fields.length} fields
            </div>
            <ul className="mt-1 text-xs">
              {f.fields.map((fd, j) => (
                <li key={j} className="text-slate-300">
                  {fd.label ?? fd.name ?? '(anonymous)'} — {fd.type}
                  {fd.required ? ' · required' : ''}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title={`Links (${page.links.length})`}>
        <ul className="max-h-40 overflow-auto text-xs">
          {page.links.map((l, i) => (
            <li key={i} className={l.inScope ? 'text-slate-300' : 'text-slate-500'}>
              {l.text} → {l.normalizedUrl} {!l.inScope && '(out of scope)'}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <div className="border border-slate-800 rounded px-2 py-1">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-100">{value}</div>
    </div>
  );
}
