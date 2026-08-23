import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from './errorHandler.js';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn: (req: Request) => string;
  message?: string;
}

interface Store {
  entries: Map<string, number[]>;
}

export function createRateLimiter(opts: RateLimitOptions): RequestHandler & { reset: () => void } {
  const store: Store = { entries: new Map() };

  const handler = (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const cutoff = now - opts.windowMs;
    const key = opts.keyFn(req);
    const bucket = store.entries.get(key) ?? [];
    // Prune expired.
    let firstIdx = 0;
    while (firstIdx < bucket.length && bucket[firstIdx]! <= cutoff) firstIdx += 1;
    const pruned = firstIdx > 0 ? bucket.slice(firstIdx) : bucket;
    if (pruned.length >= opts.max) {
      const oldest = pruned[0]!;
      const retryAfterMs = oldest + opts.windowMs - now;
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      store.entries.set(key, pruned);
      return next(new HttpError(429, opts.message ?? 'Too many requests', 'rate_limited'));
    }
    pruned.push(now);
    store.entries.set(key, pruned);
    next();
  };

  (handler as RequestHandler & { reset: () => void }).reset = (): void => {
    store.entries.clear();
  };
  return handler as RequestHandler & { reset: () => void };
}

export function ipKey(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

export function userKey(req: Request): string {
  return req.user?.id ?? ipKey(req);
}

export function ciTokenKey(req: Request): string {
  return req.ciToken?.id ?? ipKey(req);
}
