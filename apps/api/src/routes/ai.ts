import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { TestGenerator } from '../ai/testGenerator.js';
import { getConfiguredProvider } from '../ai/providerFactory.js';
import { LLMProviderError } from '../ai/providers/llmProvider.js';
import type { TestGenerationInput } from '../ai/aiTypes.js';
import type { ApplicationModel } from '@ai-bug-hunter/test-engine';
import { requireRole } from '../middleware/authenticate.js';
import { createRateLimiter, userKey } from '../middleware/rateLimit.js';

const aiGenLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 20, keyFn: userKey });

export const aiRouter = Router();

const RequestSchema = z.object({
  applicationModel: z.object({
    id: z.string(),
    baseUrl: z.string(),
    discoveredAt: z.string(),
    pages: z.array(z.unknown()).min(0).max(50),
  }).passthrough(),
  goal: z.enum(['smoke', 'functional', 'negative', 'validation', 'navigation', 'exploratory']),
  targetPage: z.string().max(2048).optional(),
  categories: z.array(z.string().max(100)).max(10).optional(),
  maxTests: z.number().int().positive().max(50).optional(),
});

aiRouter.post(
  '/ai/generate-tests',
  requireRole('qa_engineer'),
  aiGenLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return next(new HttpError(400, `Invalid AI request: ${detail}`));
    }

    let provider;
    try {
      provider = getConfiguredProvider();
    } catch (err) {
      if (err instanceof LLMProviderError && err.kind === 'missing_api_key') {
        return res.status(200).json({
          status: 'provider_error',
          tests: [],
          warnings: [],
          provider: env.LLM_PROVIDER,
          model: env.LLM_MODEL,
          durationMs: 0,
          message: 'AI test generation is not configured on the server.',
        });
      }
      return next(err);
    }

    try {
      const generator = new TestGenerator({
        provider,
        model: env.LLM_MODEL,
        maxTestsCap: env.AI_MAX_TESTS,
        promptMaxChars: env.AI_PROMPT_MAX_CHARS,
      });
      const input: TestGenerationInput = {
        applicationModel: parsed.data.applicationModel as unknown as ApplicationModel,
        goal: parsed.data.goal,
        ...(parsed.data.targetPage ? { targetPage: parsed.data.targetPage } : {}),
        ...(parsed.data.categories ? { categories: parsed.data.categories } : {}),
        ...(parsed.data.maxTests !== undefined ? { maxTests: parsed.data.maxTests } : {}),
      };
      const result = await generator.generate(input);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
