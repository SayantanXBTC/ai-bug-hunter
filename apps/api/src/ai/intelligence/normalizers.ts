import { normalizeUrl as engineNormalizeUrl, tryParseUrl } from '@ai-bug-hunter/test-engine';
import type { ErrorCategory } from './intelligenceTypes.js';

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const HEX_RE = /\b0x[0-9a-f]+\b/gi;
const LONG_NUM_RE = /\b\d{4,}\b/g;
const TIMESTAMP_RE = /\b\d{4}-\d{2}-\d{2}(?:t\d{2}:\d{2}:\d{2}(?:\.\d+)?z?)?\b/gi;
const MS_RE = /\b\d+ms\b/gi;
const WS_RE = /\s+/g;

export function normalizeErrorMessage(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw.toLowerCase();
  s = s.replace(TIMESTAMP_RE, '<time>');
  s = s.replace(UUID_RE, '<uuid>');
  s = s.replace(HEX_RE, '<hex>');
  s = s.replace(MS_RE, '<ms>');
  s = s.replace(LONG_NUM_RE, '<n>');
  s = s.replace(WS_RE, ' ').trim();
  return s.length > 200 ? s.slice(0, 200) : s;
}

export function normalizeStackFrame(raw: string): string {
  return normalizeErrorMessage(raw.split('\n')[0] ?? '');
}

export function normalizePath(pathname: string): string {
  const parts = pathname.split('/').map((seg) => {
    if (!seg) return '';
    if (UUID_RE.test(seg)) return ':id';
    if (/^\d+$/.test(seg)) return ':id';
    return seg;
  });
  return parts.join('/') || '/';
}

export function normalizeUrlForFingerprint(raw: string | null | undefined): {
  full: string;
  path: string;
} {
  if (!raw) return { full: '', path: '' };
  const parsed = tryParseUrl(raw);
  if (!parsed) return { full: raw.toLowerCase(), path: '' };
  parsed.search = '';
  parsed.hash = '';
  const normalized = engineNormalizeUrl(parsed);
  return { full: normalized, path: normalizePath(parsed.pathname) };
}

export function normalizeSelector(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/:nth-child\(\d+\)/gi, ':nth-child(*)');
  s = s.replace(/:nth-of-type\(\d+\)/gi, ':nth-of-type(*)');
  s = s.replace(/\[([a-z-]+)="[^"]*(\d{3,}|[0-9a-f]{8,})[^"]*"\]/gi, '[$1="<dyn>"]');
  s = s.replace(/#[A-Za-z][\w-]*(\d{3,}|[0-9a-f]{8,})/g, '#<dyn>');
  return s.slice(0, 200);
}

export function normalizeConsoleMessage(raw: string): string {
  return normalizeErrorMessage(raw);
}

export function categorizeError(name: string, message: string): ErrorCategory {
  const n = (name ?? '').toLowerCase();
  const m = (message ?? '').toLowerCase();
  if (n.includes('timeout') || m.includes('timeout')) return 'timeout';
  if (m.includes('waiting for locator') || m.includes('selector')) return 'selector';
  if (m.includes('http ') || /\b(500|502|503|504|400|401|403|404|429)\b/.test(m))
    return 'http';
  if (m.includes('net::') || m.includes('network')) return 'network';
  if (m.includes('navigation') || m.includes('page crashed') || m.includes('goto'))
    return 'navigation';
  if (n.includes('assertion') || m.includes('expected')) return 'assertion';
  if (m.includes('is not a function') || m.includes('undefined') || m.includes('typeerror'))
    return 'javascript';
  return 'unknown';
}

export function fingerprintHash(parts: string[]): string {
  // Deterministic short hash for cluster identity — FNV-1a 32-bit hex.
  let h = 0x811c9dc5;
  for (const p of parts) {
    for (let i = 0; i < p.length; i += 1) {
      h ^= p.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    h ^= 0x7c;
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
