import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function canAnimate(): boolean {
  if (import.meta.env.MODE === 'test') return false;
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return false;
  return !prefersReducedMotion();
}

/**
 * Animate a number from its previous value to `target`.
 * Renders the final value immediately in tests and under reduced motion.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (canAnimate() ? 0 : target));
  const fromRef = useRef(value);

  useEffect(() => {
    if (!canAnimate()) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      fromRef.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

/** Mouse handler that feeds `--mx/--my` to `.abh-spot` cards. */
export function useSpotlight(): (e: MouseEvent<HTMLElement>) => void {
  return useCallback((e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }, []);
}

/** Read/write a small boolean flag in localStorage; storage failures fall back to memory. */
export function useStoredFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch {
      // ignore
    }
    return initial;
  });
  const set = useCallback(
    (v: boolean) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v ? '1' : '0');
      } catch {
        // ignore
      }
    },
    [key],
  );
  return [value, set];
}
