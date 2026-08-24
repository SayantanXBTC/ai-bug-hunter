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
import { testCasesRouter } from './routes/testCases.js';
import { testReliabilityRouter } from './routes/testReliability.js';
import { regressionCampaignsRouter } from './routes/regressionCampaigns.js';
import { authRouter } from './routes/auth.js';
import { ciTokensRouter } from './routes/ciTokens.js';
import { ciRouter } from './routes/ci.js';
import { adminRetentionRouter } from './routes/adminRetention.js';
import { adminSettingsRouter } from './routes/adminSettings.js';
import { dashboardRouter } from './routes/dashboard.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { securityHeadersMiddleware } from './middleware/securityHeaders.js';
import { authenticate } from './middleware/authenticate.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Ordering: id → security headers → cors → body parser → logger → auth → routes.
  app.use(requestIdMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(
    cors({
      origin: env.FRONTEND_URL.trim().replace(/\/+$/, ''),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(requestLoggerMiddleware);
  app.use(authenticate);

  app.use('/api', healthRouter);
  app.use('/api', authRouter);
  app.use('/api', testRunsRouter);
  app.use('/api', applicationsRouter);
  app.use('/api', evidenceRouter);
  app.use('/api', discoveryRouter);
  app.use('/api', aiRouter);
  app.use('/api', investigationRouter);
  app.use('/api', bugIntelligenceRouter);
  app.use('/api', testCasesRouter);
  app.use('/api', testReliabilityRouter);
  app.use('/api', regressionCampaignsRouter);
  app.use('/api', ciTokensRouter);
  app.use('/api', ciRouter);
  app.use('/api', adminRetentionRouter);
  app.use('/api', adminSettingsRouter);
  app.use('/api', dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
