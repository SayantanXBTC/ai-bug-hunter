import { z } from 'zod';
import { TestActionSchema } from '@ai-bug-hunter/test-engine';

export const GeneratedTestSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  targetUrl: z.string().min(1).max(2048),
  steps: z.array(TestActionSchema).min(1).max(50),
});

export const GeneratedTestSuiteSchema = z.object({
  tests: z.array(GeneratedTestSchema).min(0).max(50),
});

export type GeneratedTest = z.infer<typeof GeneratedTestSchema>;
export type GeneratedTestSuite = z.infer<typeof GeneratedTestSuiteSchema>;
