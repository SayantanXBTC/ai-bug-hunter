import { useEffect, useState, type FormEvent } from 'react';

interface CiTokenRow {
  id: string;
  name: string;
  applicationId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function CiTokensView(): JSX.Element {
  const [items, setItems] = useState<CiTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/ci-tokens', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { items: CiTokenRow[] };
      setItems(body.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createToken(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/ci-tokens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { token: string };
      setCreatedToken(body.token);
      setNewName('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-3">CI Tokens</h2>
      {createdToken && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <div className="font-medium text-amber-900">Copy this token now. It won&apos;t be shown again.</div>
          <div className="mt-2 select-all break-all rounded bg-white p-2 font-mono text-xs">
            {createdToken}
          </div>
          <button
            onClick={() => setCreatedToken(null)}
            className="mt-2 rounded border px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Dismiss
          </button>
        </div>
      )}
      <form onSubmit={createToken} className="mb-4 flex gap-2 text-sm">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
          placeholder="Token name"
          className="flex-1 rounded border border-slate-300 px-2 py-1"
        />
        <button
          type="submit"
          className="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700"
        >
          Create
        </button>
      </form>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-500">No tokens yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1">Name</th>
              <th className="py-1">Created</th>
              <th className="py-1">Last used</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="py-1">{t.name}</td>
                <td className="py-1 text-slate-500">{t.createdAt.slice(0, 10)}</td>
                <td className="py-1 text-slate-500">{t.lastUsedAt?.slice(0, 10) ?? '—'}</td>
                <td className="py-1">{t.revokedAt ? 'revoked' : 'active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
