import { useState, type FormEvent } from 'react';

interface Props {
  onAuthenticated: () => void;
}

export function LoginView({ onAuthenticated }: Props): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (mode === 'register' && res.status === 403) {
        setError('Registration is disabled.');
        return;
      }
      if (mode === 'login' && res.status === 401) {
        setError('Invalid email or password.');
        return;
      }
      if (mode === 'login' && res.status === 429) {
        setError('Too many failed attempts. Try again later.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? `Request failed (${res.status})`);
        return;
      }
      if (mode === 'register') {
        // Auto-login after successful register.
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!loginRes.ok) {
          setError('Registered, but sign-in failed. Please log in manually.');
          setMode('login');
          return;
        }
      }
      onAuthenticated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-800">AI Bug Hunter</h1>
          <p className="text-sm text-slate-500">{mode === 'login' ? 'Sign in to continue' : 'Create an account'}</p>
        </div>
        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Password</span>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div role="alert" className="text-sm text-rose-600">{error}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          className="w-full text-xs text-slate-500 hover:text-slate-700"
        >
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
