import type { Request, Response, NextFunction } from 'express';

export const REDACT_KEYS: readonly string[] = [
  'token',
  'password',
  'secret',
  'authorization',
  'apikey',
  'api_key',
  'api-key',
  'cookie',
  'set-cookie',
];

const REDACTED = '[REDACTED]';

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[_-]/g, '');
}

const NORMALIZED_REDACT = new Set(REDACT_KEYS.map((k) => normalizeKey(k)));

export function redactValue(key: string, value: unknown): unknown {
  if (NORMALIZED_REDACT.has(normalizeKey(key))) return REDACTED;
  if (Array.isArray(value)) return value.map((v) => redactValue(key, v));
  if (value && typeof value === 'object') return redactObject(value as Record<string, unknown>);
  return value;
}

export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (NORMALIZED_REDACT.has(normalizeKey(k))) {
      out[k] = REDACTED;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactObject(v as Record<string, unknown>);
    } else if (Array.isArray(v)) {
      out[k] = v.map((entry) =>
        entry && typeof entry === 'object' ? redactObject(entry as Record<string, unknown>) : entry,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

function operationFromPath(pathname: string): string {
  // Strip leading /api and take first segment.
  const trimmed = pathname.replace(/^\/+/, '');
  const parts = trimmed.split('/');
  if (parts[0] === 'api' && parts.length > 1) return parts[1] ?? 'unknown';
  return parts[0] ?? 'unknown';
}

export interface LogEmitter {
  (line: string): void;
}

let emitter: LogEmitter = (line) => console.log(line);
export function setRequestLogEmitter(fn: LogEmitter): void {
  emitter = fn;
}
export function resetRequestLogEmitter(): void {
  emitter = (line) => console.log(line);
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();
  const method = req.method;
  const pathname = req.path;
  const operation = operationFromPath(pathname);
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const entry = {
      ts: new Date().toISOString(),
      level: 'info',
      msg: 'http:request',
      method,
      path: pathname,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      requestId: req.requestId,
      userId: req.user?.id,
      operation,
    };
    try {
      emitter(JSON.stringify(entry));
    } catch {
      /* ignore log serialization errors */
    }
  });
  next();
}
