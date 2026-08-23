import { useCallback, useEffect, useState } from 'react';

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

export function useTheme(): {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggle: () => void;
} {
  const [theme, setThemeState] = useState<ThemeMode>(() => readInitial());

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggle = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  return { theme, setTheme, toggle };
}
