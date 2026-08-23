import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';
const VALID = /^[A-Za-z0-9-]{1,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = incoming && VALID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
