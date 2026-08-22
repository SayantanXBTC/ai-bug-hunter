import { Router, type Request, type Response } from 'express';
import {
  API_SERVICE_NAME,
  type HealthResponse,
  type DetailedHealthResponse,
} from '@ai-bug-hunter/shared';
import { pingDatabase } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response<HealthResponse>) => {
  res.json({ status: 'ok', service: API_SERVICE_NAME });
});

healthRouter.get('/health/detailed', async (_req: Request, res: Response<DetailedHealthResponse>) => {
  const db = await pingDatabase();
  const body: DetailedHealthResponse = {
    status: db.reachable ? 'ok' : 'degraded',
    service: API_SERVICE_NAME,
    database: { reachable: db.reachable, latencyMs: db.latencyMs },
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  res.status(db.reachable ? 200 : 503).json(body);
});
