import { useEffect, useState } from 'react';

/**
 * Shown while the session check is pending on an app page. The API runs on a
 * free host that sleeps when idle, so the first request can take a while;
 * after a few seconds we say so instead of showing a silent spinner.
 */
export function ServerWaking(): JSX.Element {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] px-6 text-center">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)]"
        style={{ borderTopColor: 'var(--primary)' }}
      />
      {slow && (
        <div className="abh-fade-up max-w-sm">
          <div className="text-sm text-[var(--text)]">Waking up the server…</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            It sleeps when nobody has used it for a while. This can take up to a minute.
          </div>
        </div>
      )}
    </div>
  );
}
