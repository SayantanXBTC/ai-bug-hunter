import { useState, type FormEvent } from 'react';
import { LoginScene } from './login/LoginScene.js';
import { LoginCard } from './login/LoginCard.js';

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
    <LoginScene>
      <LoginCard
        mode={mode}
        email={email}
        password={password}
        error={error}
        submitting={submitting}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={submit}
        onSwitchMode={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError(null);
        }}
      />
    </LoginScene>
  );
}
