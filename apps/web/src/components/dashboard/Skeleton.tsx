interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps): JSX.Element {
  return <div aria-hidden className={`bg-neutral-100 animate-pulse rounded ${className}`} />;
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-20" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function SkeletonRow(): JSX.Element {
  return (
    <div className="flex items-center justify-between py-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
