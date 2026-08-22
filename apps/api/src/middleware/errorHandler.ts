import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler = (_req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({ error: 'Not Found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message =
    env.NODE_ENV === 'production' && status >= 500
      ? 'Internal Server Error'
      : err instanceof Error
        ? err.message
        : 'Unknown error';

  if (status >= 500 && env.NODE_ENV !== 'test') {
    console.error('[api:error]', err);
  }

  res.status(status).json({ error: message });
};
