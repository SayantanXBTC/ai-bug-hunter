import { describe, it, expect } from 'vitest';
import { assertTargetUrlAllowed, TargetUrlError } from './targetUrlPolicy.js';

function expectBlocked(url: string, code: string, opts?: { allowPrivate?: boolean }): void {
  try {
    assertTargetUrlAllowed(url, opts);
    throw new Error(`expected ${url} to be blocked`);
  } catch (err) {
    expect(err).toBeInstanceOf(TargetUrlError);
    expect((err as TargetUrlError).code).toBe(code);
  }
}

describe('assertTargetUrlAllowed', () => {
  it('allows valid https URL', () => {
    const u = assertTargetUrlAllowed('https://example.com/foo');
    expect(u.protocol).toBe('https:');
  });

  it('allows valid http URL', () => {
    expect(() => assertTargetUrlAllowed('http://example.com')).not.toThrow();
  });

  it('blocks invalid URL', () => {
    expectBlocked('not a url', 'invalid_url');
  });

  it('blocks localhost hostname', () => {
    expectBlocked('http://localhost/', 'blocked_hostname');
  });

  it('blocks 127.0.0.1 (loopback)', () => {
    expectBlocked('http://127.0.0.1/', 'blocked_ip_range');
  });

  it('blocks 127.5.5.5 (loopback range)', () => {
    expectBlocked('http://127.5.5.5/', 'blocked_ip_range');
  });

  it('blocks 10.0.0.1', () => {
    expectBlocked('http://10.0.0.1/', 'blocked_ip_range');
  });

  it('blocks 172.16.0.1 and 172.31.255.255', () => {
    expectBlocked('http://172.16.0.1/', 'blocked_ip_range');
    expectBlocked('http://172.31.255.255/', 'blocked_ip_range');
  });

  it('does NOT block 172.32.0.1 (outside private /12)', () => {
    expect(() => assertTargetUrlAllowed('http://172.32.0.1/')).not.toThrow();
  });

  it('blocks 192.168.1.1', () => {
    expectBlocked('http://192.168.1.1/', 'blocked_ip_range');
  });

  it('blocks 169.254.169.254 (cloud metadata)', () => {
    expectBlocked('http://169.254.169.254/latest/meta-data/', 'blocked_ip_range');
  });

  it('blocks 0.0.0.0', () => {
    expectBlocked('http://0.0.0.0/', 'blocked_hostname');
  });

  it('blocks IPv6 loopback ::1', () => {
    expectBlocked('http://[::1]/', 'blocked_ip_range');
  });

  it('blocks IPv6 unspecified ::', () => {
    expectBlocked('http://[::]/', 'blocked_ip_range');
  });

  it('blocks IPv6 ULA fc00::/7', () => {
    expectBlocked('http://[fc00::1]/', 'blocked_ip_range');
    expectBlocked('http://[fd12:3456::1]/', 'blocked_ip_range');
  });

  it('blocks IPv6 link-local fe80::/10', () => {
    expectBlocked('http://[fe80::1]/', 'blocked_ip_range');
  });

  it('blocks IPv4-mapped loopback ::ffff:127.0.0.1', () => {
    expectBlocked('http://[::ffff:127.0.0.1]/', 'blocked_ip_range');
  });

  it('blocks file://', () => {
    expectBlocked('file:///etc/passwd', 'blocked_protocol');
  });

  it('blocks javascript:', () => {
    expectBlocked('javascript:alert(1)', 'blocked_protocol');
  });

  it('blocks data:', () => {
    expectBlocked('data:text/html,<b>x</b>', 'blocked_protocol');
  });

  it('blocks ftp/gopher/ws/wss', () => {
    expectBlocked('ftp://example.com/', 'blocked_protocol');
    expectBlocked('gopher://example.com/', 'blocked_protocol');
    expectBlocked('ws://example.com/', 'blocked_protocol');
    expectBlocked('wss://example.com/', 'blocked_protocol');
  });

  it('allowPrivate=true allows localhost + 127.0.0.1 but STILL blocks file://', () => {
    expect(() => assertTargetUrlAllowed('http://localhost/', { allowPrivate: true })).not.toThrow();
    expect(() => assertTargetUrlAllowed('http://127.0.0.1/', { allowPrivate: true })).not.toThrow();
    expect(() => assertTargetUrlAllowed('http://192.168.1.1/', { allowPrivate: true })).not.toThrow();
    expectBlocked('file:///etc/passwd', 'blocked_protocol', { allowPrivate: true });
    expectBlocked('javascript:alert(1)', 'blocked_protocol', { allowPrivate: true });
  });
});
