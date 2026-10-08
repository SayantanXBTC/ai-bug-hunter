import { useCallback, useEffect, useState } from 'react';
import type { ViewId } from '../components/navigation.js';

/**
 * Minimal hash router. Every screen change becomes a browser history entry,
 * so the browser Back button steps through the app instead of leaving it.
 * Hash URLs (#/tests) need no server rewrite on Vercel.
 *
 *   #/            landing
 *   #/login       sign-in
 *   #/<view>      app page, e.g. #/tests
 *   #/<view>/<id> detail inside a page, e.g. #/test-runs/<runId>
 */
export type Route =
  | { screen: 'landing' }
  | { screen: 'login' }
  | { screen: 'app'; view: ViewId; id: string | null };

const VIEWS: ViewId[] = [
  'dashboard',
  'applications',
  'tests',
  'test-runs',
  'bugs',
  'reliability',
  'regression',
  'settings',
];

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, id] = parts;
  if (!head) return { screen: 'landing' };
  if (head === 'login') return { screen: 'login' };
  if ((VIEWS as string[]).includes(head)) {
    return { screen: 'app', view: head as ViewId, id: id ? decodeURIComponent(id) : null };
  }
  return { screen: 'landing' };
}

export function hashFor(route: Route): string {
  if (route.screen === 'landing') return '#/';
  if (route.screen === 'login') return '#/login';
  return route.id ? `#/${route.view}/${encodeURIComponent(route.id)}` : `#/${route.view}`;
}

export function useHashRoute(): {
  route: Route;
  navigate: (next: Route, opts?: { replace?: boolean }) => void;
} {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { screen: 'landing' } : parseHash(window.location.hash),
  );

  useEffect(() => {
    const sync = (): void => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const navigate = useCallback((next: Route, opts?: { replace?: boolean }) => {
    const target = hashFor(next);
    if (target === window.location.hash) {
      setRoute(next);
      return;
    }
    if (opts?.replace) window.history.replaceState(null, '', target);
    else window.history.pushState(null, '', target);
    setRoute(next);
  }, []);

  return { route, navigate };
}
