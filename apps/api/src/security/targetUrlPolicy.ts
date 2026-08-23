import { env as defaultEnv } from '../config/env.js';

export const ALLOWED_PROTOCOLS = ['http:', 'https:'] as const;

export type TargetUrlErrorCode =
  | 'invalid_url'
  | 'blocked_protocol'
  | 'blocked_hostname'
  | 'blocked_ip_range';

export class TargetUrlError extends Error {
  readonly code: TargetUrlErrorCode;
  constructor(message: string, code: TargetUrlErrorCode) {
    super(message);
    this.name = 'TargetUrlError';
    this.code = code;
  }
}

export interface AssertOptions {
  allowPrivate?: boolean;
}

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', 'ip6-localhost', 'ip6-loopback']);

// IPv4 CIDR ranges to block as private/reserved/loopback/etc.
const IPV4_BLOCKED_RANGES: Array<{ base: number; mask: number; label: string }> = [
  { base: ipv4ToInt('127.0.0.0'), mask: prefixMask(8), label: 'loopback (127.0.0.0/8)' },
  { base: ipv4ToInt('10.0.0.0'), mask: prefixMask(8), label: 'private (10.0.0.0/8)' },
  { base: ipv4ToInt('172.16.0.0'), mask: prefixMask(12), label: 'private (172.16.0.0/12)' },
  { base: ipv4ToInt('192.168.0.0'), mask: prefixMask(16), label: 'private (192.168.0.0/16)' },
  { base: ipv4ToInt('169.254.0.0'), mask: prefixMask(16), label: 'link-local (169.254.0.0/16)' },
  { base: ipv4ToInt('100.64.0.0'), mask: prefixMask(10), label: 'CGNAT (100.64.0.0/10)' },
  { base: ipv4ToInt('0.0.0.0'), mask: prefixMask(8), label: 'reserved (0.0.0.0/8)' },
  { base: ipv4ToInt('224.0.0.0'), mask: prefixMask(4), label: 'multicast (224.0.0.0/4)' },
];

function prefixMask(bits: number): number {
  if (bits === 0) return 0;
  // Use >>> to keep unsigned, produce a 32-bit mask.
  return (0xffffffff << (32 - bits)) >>> 0;
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`invalid ipv4: ${ip}`);
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function parseIpv4(host: string): number | null {
  // Accept dotted-quad (a.b.c.d). Reject 0-prefixed octets to avoid octal ambiguity.
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split('.').map((p) => Number(p));
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function isIpv4Blocked(intIp: number): { blocked: boolean; label?: string } {
  for (const r of IPV4_BLOCKED_RANGES) {
    if ((intIp & r.mask) === (r.base & r.mask)) return { blocked: true, label: r.label };
  }
  return { blocked: false };
}

function stripBrackets(host: string): string {
  if (host.startsWith('[') && host.endsWith(']')) return host.slice(1, -1);
  return host;
}

function expandIpv6(raw: string): number[] | null {
  // Return 8 groups of 16-bit integers, or null if not IPv6.
  if (!raw.includes(':')) return null;
  // Handle IPv4-mapped: ::ffff:1.2.3.4 -> convert tail.
  let s = raw.toLowerCase();
  const v4mapMatch = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4mapMatch) {
    const v4 = parseIpv4(v4mapMatch[2]!);
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    s = `${v4mapMatch[1]}${hi}:${lo}`;
  }

  const doubleColonParts = s.split('::');
  if (doubleColonParts.length > 2) return null;

  let head: string[] = [];
  let tail: string[] = [];
  if (doubleColonParts.length === 2) {
    head = doubleColonParts[0]!.length ? doubleColonParts[0]!.split(':') : [];
    tail = doubleColonParts[1]!.length ? doubleColonParts[1]!.split(':') : [];
    const fillCount = 8 - head.length - tail.length;
    if (fillCount < 0) return null;
    const fill = new Array(fillCount).fill('0');
    const groups = [...head, ...fill, ...tail];
    if (groups.length !== 8) return null;
    return groups.map((g) => parseInt(g, 16));
  }

  const groups = s.split(':');
  if (groups.length !== 8) return null;
  return groups.map((g) => parseInt(g, 16));
}

function isIpv6Blocked(host: string): { blocked: boolean; label?: string } {
  const groups = expandIpv6(host);
  if (!groups || groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) {
    return { blocked: false };
  }
  // Unspecified :: (all zero) or loopback ::1
  if (groups.every((g) => g === 0)) return { blocked: true, label: 'unspecified (::)' };
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) {
    return { blocked: true, label: 'loopback (::1)' };
  }
  // IPv4-mapped (::ffff:0:0/96)
  const isV4Mapped =
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff;
  if (isV4Mapped) {
    const intIp = ((groups[6]! << 16) | groups[7]!) >>> 0;
    const check = isIpv4Blocked(intIp);
    if (check.blocked) return { blocked: true, label: `ipv4-mapped ${check.label}` };
  }
  // fc00::/7 ULA — top 7 bits are 1111110
  if ((groups[0]! & 0xfe00) === 0xfc00) return { blocked: true, label: 'ULA (fc00::/7)' };
  // fe80::/10 link-local — top 10 bits 1111111010
  if ((groups[0]! & 0xffc0) === 0xfe80) return { blocked: true, label: 'link-local (fe80::/10)' };
  return { blocked: false };
}

export function assertTargetUrlAllowed(rawUrl: string, opts?: AssertOptions): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new TargetUrlError(`Invalid URL: ${rawUrl}`, 'invalid_url');
  }

  if (!(ALLOWED_PROTOCOLS as readonly string[]).includes(parsed.protocol)) {
    throw new TargetUrlError(
      `Blocked URL protocol "${parsed.protocol}"; only http/https allowed`,
      'blocked_protocol',
    );
  }

  const allowPrivate = opts?.allowPrivate ?? defaultEnv.ALLOW_PRIVATE_TARGETS;

  const hostRaw = stripBrackets(parsed.hostname).toLowerCase();
  if (!hostRaw) throw new TargetUrlError('URL has no hostname', 'invalid_url');

  if (!allowPrivate && BLOCKED_HOSTNAMES.has(hostRaw)) {
    throw new TargetUrlError(`Blocked hostname: ${hostRaw}`, 'blocked_hostname');
  }

  // IPv4?
  const intIp = parseIpv4(hostRaw);
  if (intIp !== null) {
    if (!allowPrivate) {
      const check = isIpv4Blocked(intIp);
      if (check.blocked) {
        throw new TargetUrlError(
          `Blocked IPv4 address ${hostRaw}: ${check.label}`,
          'blocked_ip_range',
        );
      }
    }
    return parsed;
  }

  // IPv6?
  if (hostRaw.includes(':')) {
    if (!allowPrivate) {
      const check = isIpv6Blocked(hostRaw);
      if (check.blocked) {
        throw new TargetUrlError(
          `Blocked IPv6 address ${hostRaw}: ${check.label}`,
          'blocked_ip_range',
        );
      }
    }
    return parsed;
  }

  // Hostname (DNS name). Note: full DNS resolution is not performed here — this
  // policy is a URL-shape gate. Callers that fetch should also enforce network
  // egress controls to prevent DNS rebinding.
  return parsed;
}
