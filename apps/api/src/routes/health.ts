import { access } from 'node:fs/promises';
import { Router, type Request, type Response } from 'express';
import {
  API_SERVICE_NAME,
  type HealthResponse,
  type DetailedHealthResponse,
} from '@ai-bug-hunter/shared';
import { pingDatabase } from '../db/pool.js';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response<HealthResponse>) => {
  res.json({ status: 'ok', service: API_SERVICE_NAME });
});

function llmStatus(): 'configured' | 'fake_fallback' | 'disabled' | 'error' {
  if (!env.LLM_ENABLED) return 'disabled';
  if (env.LLM_PROVIDER === 'fake') return 'fake_fallback';
  if (env.LLM_PROVIDER === 'anthropic') {
    return env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim() !== ''
      ? 'configured'
      : 'fake_fallback';
  }
  return 'error';
}

async function artifactOk(): Promise<boolean> {
  try {
    await access(env.ARTIFACT_STORAGE_PATH);
    return true;
  } catch {
    return false;
  }
}

healthRouter.get('/health/detailed', async (_req: Request, res: Response<DetailedHealthResponse>) => {
  const db = await pingDatabase();
  const [artifactReachable] = await Promise.all([artifactOk()]);
  const body: DetailedHealthResponse = {
    status: db.reachable ? 'ok' : 'degraded',
    service: API_SERVICE_NAME,
    database: { reachable: db.reachable, latencyMs: db.latencyMs },
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    llmProvider: { status: llmStatus() },
    artifactStorage: { ok: artifactReachable },
    // Deep browser probe would require booting Playwright; report 'unknown' here.
    browserAvailable: 'unknown',
  };
  res.status(db.reachable ? 200 : 503).json(body);
});
