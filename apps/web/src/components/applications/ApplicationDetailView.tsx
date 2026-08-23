import { useEffect, useState } from 'react';
import type { UserRole } from '@ai-bug-hunter/shared';
import {
  IconArrowLeft,
  IconGlobe,
  IconSparkles,
  IconRefresh,
  IconExternalLink,
  IconLayers,
  IconFileText,
} from '../icons.js';
import { formatNumber, formatDuration, formatRelativeTime } from '../../lib/format.js';
import { filterFormFields, sanitizeField } from '../../lib/sanitize.js';
import { DiscoveryPanel } from './DiscoveryPanel.js';
import type {
  ApplicationRow,
  DiscoveryResult,
  DiscoveredForm,
  DiscoveredElement,
  DiscoveredLink,
  PageModel,
} from './types.js';

type TabId = 'overview' | 'pages' | 'forms' | 'elements' | 'links';

interface ApplicationDetailViewProps {
  application: ApplicationRow;
  role: UserRole;
  onBack: () => void;
  onGenerateTests: () => void;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'pages', label: 'Pages' },
  { id: 'forms', label: 'Forms' },
  { id: 'elements', label: 'Elements' },
  { id: 'links', label: 'Links' },
];

export function ApplicationDetailView({
  application,
  role,
  onBack,
  onGenerateTests,
}: ApplicationDetailViewProps): JSX.Element {
  const canWrite = role === 'admin' || role === 'qa_engineer';
  const [tab, setTab] = useState<TabId>('overview');
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Reset discovery when the selected application changes.
  useEffect(() => {
    setDiscovery(null);
    setTab('overview');
  }, [application.id]);

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        >
          <IconArrowLeft size={14} />
          Back to Applications
        </button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-900">{application.name}</h1>
            <StatusPill discovered={Boolean(discovery)} />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
            <IconGlobe size={14} />
            <a
              href={application.base_url}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate font-mono text-xs text-neutral-600 hover:text-neutral-900"
            >
              {application.base_url}
            </a>
            <IconExternalLink size={12} className="text-neutral-400" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400"
              >
                <IconRefresh size={14} />
                {discovery ? 'Re-discover' : 'Discover'}
              </button>
              <button
                type="button"
                onClick={onGenerateTests}
                className="inline-flex items-center gap-1.5 rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <IconSparkles size={14} />
                Generate Tests
              </button>
            </>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <nav role="tablist" aria-label="Application detail sections" className="-mb-px flex flex-wrap gap-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setTab(t.id)}
                className={`border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 ${
                  active
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'overview' && (
        <OverviewTab discovery={discovery} canDiscover={canWrite} onDiscover={() => setPanelOpen(true)} />
      )}
      {tab === 'pages' && <PagesTab discovery={discovery} />}
      {tab === 'forms' && <FormsTab discovery={discovery} />}
      {tab === 'elements' && <ElementsTab discovery={discovery} />}
      {tab === 'links' && <LinksTab discovery={discovery} />}

      <DiscoveryPanel
        open={panelOpen}
        applicationBaseUrl={application.base_url}
        onClose={() => setPanelOpen(false)}
        onComplete={(r) => setDiscovery(r)}
        onGenerateTests={onGenerateTests}
      />
    </div>
  );
}

function StatusPill({ discovered }: { discovered: boolean }): JSX.Element {
  if (discovered) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Discovered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600">
      Ready
    </span>
  );
}

function OverviewTab({
  discovery,
  canDiscover,
  onDiscover,
}: {
  discovery: DiscoveryResult | null;
  canDiscover: boolean;
  onDiscover: () => void;
}): JSX.Element {
  if (!discovery) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
          <IconLayers size={18} />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-neutral-900">Application not discovered yet.</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Run discovery to build a structured application model.
        </p>
        {canDiscover && (
          <button
            type="button"
            onClick={onDiscover}
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
          >
            <IconRefresh size={14} />
            Discover
          </button>
        )}
      </div>
    );
  }

  const s = discovery.stats;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard label="Pages" value={formatNumber(s.pagesDiscovered)} />
      <MetricCard label="Forms" value={formatNumber(s.forms)} />
      <MetricCard label="Interactive elements" value={formatNumber(s.interactiveElements)} />
      <MetricCard label="Links" value={formatNumber(s.linksFound)} />
      <MetricCard label="Last discovery" value={formatRelativeTime(discovery.application.discoveredAt)} />
      <MetricCard label="Discovery duration" value={formatDuration(s.crawlDurationMs)} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</div>
    </div>
  );
}

function EmptyDiscoveryNotice(): JSX.Element {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
      Run discovery to populate this section.
    </div>
  );
}

function PagesTab({ discovery }: { discovery: DiscoveryResult | null }): JSX.Element {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!discovery) return <EmptyDiscoveryNotice />;
  const pages = discovery.application.pages;
  if (pages.length === 0) {
    return <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">No pages found.</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <ul className="divide-y divide-neutral-200">
        {pages.map((p, i) => {
          const isOpen = expanded === i;
          return (
            <li key={p.url}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-400"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-neutral-900">{p.title || p.path || p.url}</div>
                  <div className="mt-0.5 truncate font-mono text-xs text-neutral-500">{p.path || p.url}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
                  <span className="tabular-nums"><span className="font-medium text-neutral-700">{p.elements.length}</span> elements</span>
                  <span className="tabular-nums"><span className="font-medium text-neutral-700">{p.forms.length}</span> forms</span>
                  <span className="tabular-nums"><span className="font-medium text-neutral-700">{p.links.length}</span> links</span>
                </div>
              </button>
              {isOpen && <PageDetailPanel page={p} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PageDetailPanel({ page }: { page: PageModel }): JSX.Element {
  return (
    <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4 text-sm">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">URL</div>
          <div className="mt-1 break-all font-mono text-xs text-neutral-700">{page.url}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Headings ({page.headings.length})</div>
          <ul className="mt-1 space-y-0.5 text-xs text-neutral-700">
            {page.headings.slice(0, 8).map((h, i) => (
              <li key={i}>
                <span className="text-neutral-400">H{h.level}</span> {h.text}
              </li>
            ))}
            {page.headings.length === 0 && <li className="text-neutral-400">—</li>}
          </ul>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Counts</div>
          <div className="mt-1 space-y-0.5 text-xs text-neutral-700 tabular-nums">
            <div>Elements: {page.elements.length}</div>
            <div>Forms: {page.forms.length}</div>
            <div>Links: {page.links.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormsTab({ discovery }: { discovery: DiscoveryResult | null }): JSX.Element {
  if (!discovery) return <EmptyDiscoveryNotice />;
  const forms: Array<{ pagePath: string; form: DiscoveredForm; index: number }> = [];
  for (const p of discovery.application.pages) {
    p.forms.forEach((f, i) => forms.push({ pagePath: p.path || p.url, form: f, index: i }));
  }
  if (forms.length === 0) {
    return <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">No forms discovered.</div>;
  }
  return (
    <div className="space-y-4">
      {forms.map(({ pagePath, form, index }) => {
        const safeFields = filterFormFields<DiscoveredForm['fields'][number]>(form.fields);
        const submit = form.submitSelectors[0];
        return (
          <div key={`${pagePath}-${index}`} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <IconFileText size={14} className="text-neutral-500" />
                  <span className="font-medium uppercase tracking-wider text-neutral-500">{form.method || 'GET'}</span>
                  <span className="truncate font-mono text-xs text-neutral-700">{form.action || '(current page)'}</span>
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-neutral-500">on {pagePath}</div>
              </div>
              <div className="text-xs text-neutral-500 tabular-nums">{safeFields.length} field{safeFields.length === 1 ? '' : 's'}</div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-1 pr-4 font-medium">Label</th>
                    <th className="py-1 pr-4 font-medium">Name</th>
                    <th className="py-1 pr-4 font-medium">Type</th>
                    <th className="py-1 pr-4 font-medium">Required</th>
                    <th className="py-1 pr-4 font-medium">Recommended selector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {safeFields.map((fd, j) => {
                    const sel = Array.isArray(fd.selectors) ? (fd.selectors as Array<{ strategy: string; value: string }>)[0] : undefined;
                    return (
                      <tr key={j} className="text-neutral-700">
                        <td className="py-1.5 pr-4">{fd.label ?? '—'}</td>
                        <td className="py-1.5 pr-4 font-mono text-neutral-600">{fd.name ?? '—'}</td>
                        <td className="py-1.5 pr-4">{fd.type}</td>
                        <td className="py-1.5 pr-4">{fd.required ? 'Yes' : 'No'}</td>
                        <td className="py-1.5 pr-4 font-mono text-neutral-500">
                          {sel ? `${sel.strategy}: ${sel.value}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {submit && (
              <div className="mt-3 text-xs text-neutral-500">
                Submit selector: <span className="font-mono text-neutral-700">{submit.strategy}: {submit.value}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ElementsTab({ discovery }: { discovery: DiscoveryResult | null }): JSX.Element {
  if (!discovery) return <EmptyDiscoveryNotice />;
  const elements: Array<{ pagePath: string; el: DiscoveredElement }> = [];
  for (const p of discovery.application.pages) {
    for (const e of p.elements) elements.push({ pagePath: p.path || p.url, el: e });
  }
  if (elements.length === 0) {
    return <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">No interactive elements discovered.</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Tag</th>
              <th className="px-4 py-2 font-medium">Accessible name</th>
              <th className="px-4 py-2 font-medium">testId</th>
              <th className="px-4 py-2 font-medium">Recommended selector</th>
              <th className="px-4 py-2 font-medium">Page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {elements.slice(0, 500).map(({ pagePath, el }, i) => {
              const safe = sanitizeField<DiscoveredElement>(el);
              const sel = safe.selectors?.[0];
              return (
                <tr key={i} className="text-neutral-700">
                  <td className="px-4 py-1.5"><span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">{safe.category}</span></td>
                  <td className="px-4 py-1.5 font-mono text-neutral-600">{safe.tagName}</td>
                  <td className="px-4 py-1.5">{safe.accessibleName ?? '—'}</td>
                  <td className="px-4 py-1.5 font-mono text-neutral-600">{safe.testId ?? '—'}</td>
                  <td className="px-4 py-1.5 font-mono text-neutral-500">{sel ? `${sel.strategy}: ${sel.value}` : '—'}</td>
                  <td className="px-4 py-1.5 font-mono text-neutral-500">{pagePath}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {elements.length > 500 && (
        <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500">
          Showing first 500 of {elements.length} elements.
        </div>
      )}
    </div>
  );
}

function LinksTab({ discovery }: { discovery: DiscoveryResult | null }): JSX.Element {
  if (!discovery) return <EmptyDiscoveryNotice />;
  const links: Array<{ pagePath: string; link: DiscoveredLink }> = [];
  for (const p of discovery.application.pages) {
    for (const l of p.links) links.push({ pagePath: p.path || p.url, link: l });
  }
  if (links.length === 0) {
    return <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">No links discovered.</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Text</th>
              <th className="px-4 py-2 font-medium">URL</th>
              <th className="px-4 py-2 font-medium">Scope</th>
              <th className="px-4 py-2 font-medium">From page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {links.slice(0, 500).map(({ pagePath, link }, i) => (
              <tr key={i} className="text-neutral-700">
                <td className="px-4 py-1.5">{link.text || '—'}</td>
                <td className="px-4 py-1.5 font-mono text-neutral-600 break-all">{link.normalizedUrl}</td>
                <td className="px-4 py-1.5">
                  {link.inScope ? (
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-700">in scope</span>
                  ) : (
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-neutral-600">external</span>
                  )}
                </td>
                <td className="px-4 py-1.5 font-mono text-neutral-500">{pagePath}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {links.length > 500 && (
        <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500">
          Showing first 500 of {links.length} links.
        </div>
      )}
    </div>
  );
}
