import { z } from 'zod';

const NonEmpty = z.string().min(1);
const Selector = NonEmpty.max(1000);

export const NavigateActionSchema = z.object({
  action: z.literal('navigate'),
  url: NonEmpty.max(2048),
});

export const ClickActionSchema = z.object({
  action: z.literal('click'),
  selector: Selector,
});

export const FillActionSchema = z.object({
  action: z.literal('fill'),
  selector: Selector,
  value: z.string().max(10_000),
});

export const SelectOptionActionSchema = z.object({
  action: z.literal('selectOption'),
  selector: Selector,
  value: NonEmpty.max(1000),
});

export const PressActionSchema = z.object({
  action: z.literal('press'),
  selector: Selector,
  key: NonEmpty.max(100),
});

export const WaitForSelectorActionSchema = z.object({
  action: z.literal('waitForSelector'),
  selector: Selector,
  timeoutMs: z.number().int().positive().max(120_000).optional(),
});

export const WaitActionSchema = z.object({
  action: z.literal('wait'),
  durationMs: z.number().int().nonnegative().max(60_000),
});

export const TestActionSchema = z.discriminatedUnion('action', [
  NavigateActionSchema,
  ClickActionSchema,
  FillActionSchema,
  SelectOptionActionSchema,
  PressActionSchema,
  WaitForSelectorActionSchema,
  WaitActionSchema,
]);

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function assertSafeUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol "${parsed.protocol}"; only http/https allowed`);
  }
  return parsed;
}

export const TestDefinitionSchema = z
  .object({
    id: NonEmpty.max(200),
    name: NonEmpty.max(500),
    targetUrl: NonEmpty.max(2048),
    steps: z.array(TestActionSchema).min(1).max(100),
    timeoutMs: z.number().int().positive().max(600_000).optional(),
  })
  .superRefine((val, ctx) => {
    try {
      assertSafeUrl(val.targetUrl);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetUrl'],
        message: err instanceof Error ? err.message : 'Invalid URL',
      });
    }
    val.steps.forEach((step, i) => {
      if (step.action === 'navigate') {
        try {
          assertSafeUrl(step.url);
        } catch (err) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['steps', i, 'url'],
            message: err instanceof Error ? err.message : 'Invalid URL',
          });
        }
      }
    });
  });

export type ValidatedTestAction = z.infer<typeof TestActionSchema>;
export type ValidatedTestDefinition = z.infer<typeof TestDefinitionSchema>;
