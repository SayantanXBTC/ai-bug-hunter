import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { TestDefinitionSchema } from '@ai-bug-hunter/test-engine';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { assertTargetUrlAllowed, TargetUrlError } from '../security/targetUrlPolicy.js';
import type { TestDefinition } from '@ai-bug-hunter/test-engine';

function validateDefinitionUrls(def: TestDefinition): string | null {
  try {
    assertTargetUrlAllowed(def.targetUrl);
    for (let i = 0; i < def.steps.length; i += 1) {
      const step = def.steps[i]!;
      if (step.action === 'navigate') assertTargetUrlAllowed(step.url);
    }
    return null;
  } catch (err) {
    if (err instanceof TargetUrlError) return `${err.code}: ${err.message}`;
    return err instanceof Error ? err.message : 'invalid url';
  }
}
import {
  getTestCaseById,
  insertTestCase,
  listTestCases,
  updateTestCase,
} from '../db/repositories/testCaseRepo.js';
import { requireRole, requireUser } from '../middleware/authenticate.js';

export const testCasesRouter = Router();

const CreateSchema = z.object({
  applicationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  source: z.enum(['generated', 'manual', 'imported']).optional(),
  enabled: z.boolean().optional(),
  definition: TestDefinitionSchema,
});

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  enabled: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  definition: TestDefinitionSchema.optional(),
});

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  applicationId: z.string().uuid().optional(),
  enabled: z.enum(['true', 'false']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  tag: z.string().max(50).optional(),
});

const UuidParam = z.string().uuid();

testCasesRouter.post('/test-cases', requireRole('qa_engineer'), async (req: Request, res: Response, next: NextFunction) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return next(new HttpError(400, `Invalid test case: ${detail}`));
  }
  const urlErr = validateDefinitionUrls(parsed.data.definition);
  if (urlErr) return next(new HttpError(400, `Invalid target URL: ${urlErr}`));
  try {
    const row = await insertTestCase(pool, {
      ...parsed.data,
      targetUrl: parsed.data.definition.targetUrl,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

testCasesRouter.get('/test-cases', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  const parsed = ListSchema.safeParse(req.query);
  if (!parsed.success) return next(new HttpError(400, 'Invalid query'));
  try {
    const enabled = parsed.data.enabled === undefined ? undefined : parsed.data.enabled === 'true';
    const opts: Parameters<typeof listTestCases>[1] = {
      page: parsed.data.page,
      limit: parsed.data.limit,
      ...(parsed.data.applicationId ? { applicationId: parsed.data.applicationId } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.tag ? { tag: parsed.data.tag } : {}),
    };
    const { items, total } = await listTestCases(pool, opts);
    res.json({ items, page: parsed.data.page, limit: parsed.data.limit, total });
  } catch (err) {
    next(err);
  }
});

testCasesRouter.get('/test-cases/:id', requireUser, async (req: Request, res: Response, next: NextFunction) => {
  const id = UuidParam.safeParse(req.params.id);
  if (!id.success) return next(new HttpError(400, 'Invalid id'));
  try {
    const row = await getTestCaseById(pool, id.data);
    if (!row) return next(new HttpError(404, 'Test case not found'));
    res.json(row);
  } catch (err) {
    next(err);
  }
});

testCasesRouter.patch('/test-cases/:id', requireRole('qa_engineer'), async (req: Request, res: Response, next: NextFunction) => {
  const id = UuidParam.safeParse(req.params.id);
  if (!id.success) return next(new HttpError(400, 'Invalid id'));
  const parsed = PatchSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(400, 'Invalid patch'));
  if (parsed.data.definition) {
    const urlErr = validateDefinitionUrls(parsed.data.definition);
    if (urlErr) return next(new HttpError(400, `Invalid target URL: ${urlErr}`));
  }
  try {
    const patch: Parameters<typeof updateTestCase>[2] = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
    if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
    if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags;
    if (parsed.data.definition !== undefined) {
      patch.definition = parsed.data.definition;
      patch.targetUrl = parsed.data.definition.targetUrl;
    }
    const row = await updateTestCase(pool, id.data, patch);
    if (!row) return next(new HttpError(404, 'Test case not found'));
    res.json(row);
  } catch (err) {
    next(err);
  }
});
