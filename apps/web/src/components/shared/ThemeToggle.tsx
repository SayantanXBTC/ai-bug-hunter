import { useTheme, type ThemeMode } from '../../lib/theme.js';

function SunIcon(): JSX.Element {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ThemeToggle(): JSX.Element {
  const { theme, toggle } = useTheme();
  const opposite: ThemeMode = theme === 'dark' ? 'light' : 'dark';
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${opposite} mode`}
      title={`Switch to ${opposite} mode`}
      className="relative inline-flex h-9 w-[66px] items-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-1 transition-colors hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 flex items-center pl-2 text-[var(--text-subtle)]"
      >
        <SunIcon />
      </span>
      <span
        aria-hidden
        className="absolute inset-y-0 right-0 flex items-center pr-2 text-[var(--text-subtle)]"
      >
        <MoonIcon />
      </span>
      <span
        aria-hidden
        className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-[0_4px_12px_-4px_var(--primary)] transition-transform duration-500"
        style={{
          transform: isDark ? 'translateX(29px) rotate(360deg)' : 'translateX(0px) rotate(0deg)',
          transitionTimingFunction: 'var(--ease-spring)',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        }}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}
