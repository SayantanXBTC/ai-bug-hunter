import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@ai-bug-hunter/shared';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export function useAuth(): AuthState & {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.status === 401) {
        setState({ user: null, loading: false, error: null });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: { user: AuthUser } = await res.json();
      setState({ user: body.user, loading: false, error: null });
    } catch (e) {
      setState({ user: null, loading: false, error: e instanceof Error ? e.message : 'error' });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh, logout };
}
