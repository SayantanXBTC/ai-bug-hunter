import { Router, type Request, type Response, type NextFunction } from 'express';
import { TestDefinitionSchema, TestExecutor, type ExecutionResult } from '@ai-bug-hunter/test-engine';
import { HttpError } from '../middleware/errorHandler.js';

export const testRunsRouter = Router();

testRunsRouter.post(
  '/test-runs',
  async (req: Request, res: Response<ExecutionResult>, next: NextFunction) => {
    const parsed = TestDefinitionSchema.safeParse(req.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return next(new HttpError(400, `Invalid test definition: ${detail}`));
    }

    try {
      const executor = new TestExecutor();
      const result = await executor.run(parsed.data);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
