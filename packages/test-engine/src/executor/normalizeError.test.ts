import { describe, it, expect } from 'vitest';
import { normalizeError } from './testExecutor.js';

describe('normalizeError', () => {
  it('normalizes Error instances', () => {
    const e = new Error('boom');
    e.name = 'TimeoutError';
    const n = normalizeError(e, 2);
    expect(n).toEqual({ name: 'TimeoutError', message: 'boom', stepIndex: 2 });
  });

  it('handles non-Error values', () => {
    const n = normalizeError('string thrown');
    expect(n.name).toBe('UnknownError');
    expect(n.message).toBe('string thrown');
    expect(n.stepIndex).toBeUndefined();
  });

  it('truncates very long messages', () => {
    const long = 'x'.repeat(3000);
    const n = normalizeError(new Error(long));
    expect(n.message.length).toBeLessThanOrEqual(2001);
    expect(n.message.endsWith('…')).toBe(true);
  });
});
