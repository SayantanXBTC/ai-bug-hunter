import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'abh-theme';

function readInitial(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore
  }
  if (typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    } catch {
      // ignore
    }
  }
  return 'dark';
}

function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

// Module-level store so every useTheme() caller (top bar toggle, settings,
// command palette) sees the same value and re-renders together.
let current: ThemeMode = readInitial();
const listeners = new Set<() => void>();

function setCurrent(next: ThemeMode): void {
  if (next === current) return;
  current = next;
  applyTheme(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggle: () => void;
} {
  const theme = useSyncExternalStore(subscribe, () => current, () => current);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => setCurrent(t), []);
  const toggle = useCallback(() => setCurrent(current === 'dark' ? 'light' : 'dark'), []);

  return { theme, setTheme, toggle };
}
