import { describe, it, expect } from 'vitest';
import { hashFor, parseHash } from './router.js';

describe('hash router', () => {
  it('parses landing, login, pages and details', () => {
    expect(parseHash('')).toEqual({ screen: 'landing' });
    expect(parseHash('#/')).toEqual({ screen: 'landing' });
    expect(parseHash('#/login')).toEqual({ screen: 'login' });
    expect(parseHash('#/tests')).toEqual({ screen: 'app', view: 'tests', id: null });
    expect(parseHash('#/test-runs/abc-123')).toEqual({ screen: 'app', view: 'test-runs', id: 'abc-123' });
  });

  it('falls back to landing for unknown pages', () => {
    expect(parseHash('#/nope')).toEqual({ screen: 'landing' });
  });

  it('round-trips through hashFor', () => {
    const route = { screen: 'app' as const, view: 'applications' as const, id: 'a/b' };
    expect(parseHash(hashFor(route))).toEqual(route);
  });
});
