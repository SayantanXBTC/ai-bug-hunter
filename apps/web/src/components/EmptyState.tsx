interface EmptyStateProps {
  text: string;
}

export function EmptyState({ text }: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
