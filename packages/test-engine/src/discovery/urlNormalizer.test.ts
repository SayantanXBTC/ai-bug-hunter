import { describe, it, expect } from 'vitest';
import {
  isAllowedProtocol,
  isIgnoredProtocol,
  isInScope,
  normalizeUrl,
  tryParseUrl,
} from './urlNormalizer.js';

describe('normalizeUrl', () => {
  it('drops fragment', () => {
    expect(normalizeUrl(new URL('http://a.test/x#top'))).toBe('http://a.test/x');
  });

  it('lowercases host and protocol', () => {
    expect(normalizeUrl(new URL('HTTP://A.Test/x'))).toBe('http://a.test/x');
  });

  it('drops default ports', () => {
    expect(normalizeUrl(new URL('http://a.test:80/x'))).toBe('http://a.test/x');
    expect(normalizeUrl(new URL('https://a.test:443/x'))).toBe('https://a.test/x');
  });

  it('drops trailing slash except root', () => {
    expect(normalizeUrl(new URL('http://a.test/'))).toBe('http://a.test/');
    expect(normalizeUrl(new URL('http://a.test/x/'))).toBe('http://a.test/x');
  });

  it('sorts query params deterministically but preserves them', () => {
    expect(normalizeUrl(new URL('http://a.test/x?b=2&a=1'))).toBe('http://a.test/x?a=1&b=2');
  });
});

describe('protocol helpers', () => {
  it('allows http/https', () => {
    expect(isAllowedProtocol(new URL('http://a'))).toBe(true);
    expect(isAllowedProtocol(new URL('https://a'))).toBe(true);
  });
  it('rejects file/ws/etc', () => {
    expect(isAllowedProtocol(new URL('file:///etc/passwd'))).toBe(false);
  });
  it('flags ignored raw hrefs', () => {
    expect(isIgnoredProtocol('mailto:x@y')).toBe(true);
    expect(isIgnoredProtocol('javascript:void(0)')).toBe(true);
    expect(isIgnoredProtocol('data:text/plain,hi')).toBe(true);
    expect(isIgnoredProtocol('/relative')).toBe(false);
    expect(isIgnoredProtocol('https://ok')).toBe(false);
  });
});

describe('isInScope', () => {
  const base = new URL('http://a.test:8080/');
  it('accepts same origin', () => {
    expect(
      isInScope(new URL('http://a.test:8080/x'), {
        baseUrl: base,
        sameOriginOnly: true,
        allowedHosts: [],
      }),
    ).toBe(true);
  });
  it('rejects different port with sameOriginOnly', () => {
    expect(
      isInScope(new URL('http://a.test:9090/x'), {
        baseUrl: base,
        sameOriginOnly: true,
        allowedHosts: [],
      }),
    ).toBe(false);
  });
  it('accepts allowedHosts even if different origin', () => {
    expect(
      isInScope(new URL('http://b.test/x'), {
        baseUrl: base,
        sameOriginOnly: true,
        allowedHosts: ['b.test'],
      }),
    ).toBe(true);
  });
});

describe('tryParseUrl', () => {
  it('returns null for malformed', () => {
    expect(tryParseUrl('not a url')).toBeNull();
  });
  it('resolves relative against base', () => {
    expect(tryParseUrl('/x', 'http://a.test/')?.href).toBe('http://a.test/x');
  });
});
