import { describe, it, expect } from 'vitest';
import { TestActionSchema, TestDefinitionSchema, assertSafeUrl } from './actionTypes.js';

describe('TestActionSchema', () => {
  it('accepts navigate with http URL', () => {
    const r = TestActionSchema.safeParse({ action: 'navigate', url: 'http://example.com' });
    expect(r.success).toBe(true);
  });

  it('accepts fill action', () => {
    const r = TestActionSchema.safeParse({ action: 'fill', selector: '#a', value: 'x' });
    expect(r.success).toBe(true);
  });

  it('rejects unknown action', () => {
    const r = TestActionSchema.safeParse({ action: 'screenshot' });
    expect(r.success).toBe(false);
  });

  it('rejects empty selector', () => {
    const r = TestActionSchema.safeParse({ action: 'click', selector: '' });
    expect(r.success).toBe(false);
  });

  it('rejects wait with negative duration', () => {
    const r = TestActionSchema.safeParse({ action: 'wait', durationMs: -1 });
    expect(r.success).toBe(false);
  });
});

describe('TestDefinitionSchema', () => {
  const valid = {
    id: 't1',
    name: 'sample',
    targetUrl: 'https://example.com',
    steps: [{ action: 'navigate' as const, url: 'https://example.com' }],
  };

  it('accepts valid definition', () => {
    expect(TestDefinitionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects file:// target', () => {
    const r = TestDefinitionSchema.safeParse({ ...valid, targetUrl: 'file:///etc/passwd' });
    expect(r.success).toBe(false);
  });

  it('rejects file:// inside step', () => {
    const r = TestDefinitionSchema.safeParse({
      ...valid,
      steps: [{ action: 'navigate', url: 'file:///etc/passwd' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects zero steps', () => {
    const r = TestDefinitionSchema.safeParse({ ...valid, steps: [] });
    expect(r.success).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  it('allows http', () => {
    expect(() => assertSafeUrl('http://a')).not.toThrow();
  });
  it('allows https', () => {
    expect(() => assertSafeUrl('https://a')).not.toThrow();
  });
  it('rejects file', () => {
    expect(() => assertSafeUrl('file:///tmp/x')).toThrow(/Unsupported/);
  });
  it('rejects javascript:', () => {
    expect(() => assertSafeUrl('javascript:alert(1)')).toThrow(/Unsupported/);
  });
  it('rejects malformed', () => {
    expect(() => assertSafeUrl('not a url')).toThrow(/Invalid URL/);
  });
});
