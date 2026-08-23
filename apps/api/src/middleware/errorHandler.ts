import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    stack?: string;
  };
}

function pickCode(err: unknown, status: number): string {
  if (err && typeof err === 'object') {
    const c = (err as { code?: unknown }).code;
    if (typeof c === 'string' && c.length > 0) return c;
  }
  if (status === 404) return 'not_found';
  if (status === 400) return 'bad_request';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'internal_error';
  return 'error';
}

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  const body: ErrorBody = {
    error: {
      code: 'not_found',
      message: 'Not Found',
      ...(req.requestId ? { requestId: req.requestId } : {}),
    },
  };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const code = pickCode(err, status);
  const message =
    env.NODE_ENV === 'production' && status >= 500
      ? 'Internal Server Error'
      : err instanceof Error
        ? err.message
        : 'Unknown error';

  if (status >= 500 && env.NODE_ENV !== 'test') {
    console.error('[api:error]', err);
  }

  const body: ErrorBody = {
    error: {
      code,
      message,
      ...(req.requestId ? { requestId: req.requestId } : {}),
    },
  };
  if (env.NODE_ENV !== 'production' && err instanceof Error && err.stack) {
    body.error.stack = err.stack;
  }
  res.status(status).json(body);
};
