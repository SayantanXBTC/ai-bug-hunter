const IGNORED_PROTOCOLS = new Set([
  'javascript:',
  'mailto:',
  'tel:',
  'data:',
  'blob:',
  'file:',
]);

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function tryParseUrl(raw: string, base?: string): URL | null {
  try {
    return base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
}

export function isAllowedProtocol(u: URL): boolean {
  return ALLOWED_PROTOCOLS.has(u.protocol);
}

export function isIgnoredProtocol(raw: string): boolean {
  const idx = raw.indexOf(':');
  if (idx <= 0) return false;
  return IGNORED_PROTOCOLS.has(raw.slice(0, idx + 1).toLowerCase());
}

export function normalizeUrl(u: URL): string {
  const clone = new URL(u.toString());
  clone.hash = '';
  clone.protocol = clone.protocol.toLowerCase();
  clone.hostname = clone.hostname.toLowerCase();
  if (
    (clone.protocol === 'http:' && clone.port === '80') ||
    (clone.protocol === 'https:' && clone.port === '443')
  ) {
    clone.port = '';
  }
  if (clone.pathname !== '/' && clone.pathname.endsWith('/')) {
    clone.pathname = clone.pathname.slice(0, -1);
  }
  const entries = Array.from(clone.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
  const params = new URLSearchParams();
  for (const [k, v] of entries) params.append(k, v);
  clone.search = params.toString() ? '?' + params.toString() : '';
  return clone.toString();
}

export interface ScopeConfig {
  baseUrl: URL;
  sameOriginOnly: boolean;
  allowedHosts: string[];
}

export function isInScope(u: URL, cfg: ScopeConfig): boolean {
  if (!isAllowedProtocol(u)) return false;
  const host = u.hostname.toLowerCase();
  if (cfg.allowedHosts.includes(host)) return true;
  if (cfg.sameOriginOnly) {
    return u.origin.toLowerCase() === cfg.baseUrl.origin.toLowerCase();
  }
  return true;
}
