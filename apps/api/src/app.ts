import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { testRunsRouter } from './routes/testRuns.js';
import { applicationsRouter } from './routes/applications.js';
import { evidenceRouter } from './routes/evidence.js';
import { discoveryRouter } from './routes/discovery.js';
import { aiRouter } from './routes/ai.js';
import { investigationRouter } from './routes/investigation.js';
import { bugIntelligenceRouter } from './routes/bugIntelligence.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.use('/api', healthRouter);
  app.use('/api', testRunsRouter);
  app.use('/api', applicationsRouter);
  app.use('/api', evidenceRouter);
  app.use('/api', discoveryRouter);
  app.use('/api', aiRouter);
  app.use('/api', investigationRouter);
  app.use('/api', bugIntelligenceRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
