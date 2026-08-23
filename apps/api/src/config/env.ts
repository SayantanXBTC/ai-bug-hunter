import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import dotenv from 'dotenv';

function findEnvFile(startDir: string): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 6; i += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

const envPath = findEnvFile(dirname(fileURLToPath(import.meta.url)));
dotenv.config(envPath ? { path: envPath } : undefined);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_HOST: z.string().min(1).default('127.0.0.1'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().min(1).default('ai_bug_hunter'),
  DATABASE_USER: z.string().min(1).default('postgres'),
  DATABASE_PASSWORD: z.string().default(''),
  ARTIFACT_STORAGE_PATH: z.string().min(1).default('./artifacts'),
  TEST_RUNS_LIST_MAX_LIMIT: z.coerce.number().int().positive().max(200).default(100),
  LLM_PROVIDER: z.enum(['anthropic', 'fake']).default('anthropic'),
  LLM_MODEL: z.string().min(1).default('claude-sonnet-4-6'),
  LLM_ENABLED: z
    .union([z.boolean(), z.string()])
    .default(true)
    .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() !== 'false' && v !== '0')),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().max(200_000).default(4096),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().max(600_000).default(60_000),
  ANTHROPIC_API_KEY: z.string().default(''),
  ALLOW_PRIVATE_TARGETS: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() === 'true' || v === '1')),
  AI_MAX_TESTS: z.coerce.number().int().positive().max(50).default(20),
  AI_PROMPT_MAX_CHARS: z.coerce.number().int().positive().max(200_000).default(30_000),
  BUG_INTEL_MAX_RUNS: z.coerce.number().int().positive().max(5_000).default(500),
  BUG_INTEL_MAX_CANDIDATE_PAIRS: z.coerce.number().int().positive().max(50_000).default(2_000),
  BUG_INTEL_MAX_AI_COMPARISONS: z.coerce.number().int().nonnegative().max(1_000).default(100),
  BUG_INTEL_MIN_RESOLUTION_STREAK: z.coerce.number().int().positive().max(50).default(3),
  MIN_FLAKY_RUNS: z.coerce.number().int().positive().max(500).default(10),
  REGRESSION_MAX_CONCURRENCY: z.coerce.number().int().positive().max(20).default(1),
  MAX_AUTO_INVESTIGATIONS_PER_CAMPAIGN: z.coerce.number().int().nonnegative().max(200).default(20),
  MAX_AI_SUMMARIES_PER_CAMPAIGN: z.coerce.number().int().nonnegative().max(50).default(10),
  AUTH_ALLOW_REGISTRATION: z
    .union([z.boolean(), z.string()])
    .default(true)
    .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() !== 'false' && v !== '0')),
  AUTH_DEFAULT_ROLE: z.enum(['admin', 'qa_engineer', 'viewer']).default('viewer'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().max(365).default(7),
  CI_DEGRADED_EXIT_CODE: z.coerce.number().int().min(0).max(255).default(0),
  RETENTION_ENABLED: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() === 'true' || v === '1')),
  TEST_AUTH_BYPASS: z.string().default(''),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const env: AppEnv = loadEnv();
