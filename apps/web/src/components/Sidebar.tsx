interface SidebarProps {
  sections: Array<{ id: string; label: string }>;
}

export function Sidebar({ sections }: SidebarProps): JSX.Element {
  return (
    <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/40 p-6">
      <div className="text-lg font-semibold text-brand-500">AI Bug Hunter</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-slate-500">Phase 1</div>
      <nav className="mt-8 space-y-1">
        <a
          href="#overview"
          className="block rounded px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          Overview
        </a>
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="block rounded px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            {s.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
