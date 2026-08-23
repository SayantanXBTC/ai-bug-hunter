import { Router, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import { requireRole } from '../middleware/authenticate.js';

export const adminSettingsRouter = Router();

export function maskApiKey(key: string | null | undefined): string | undefined {
  if (!key || key.trim() === '') return undefined;
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 4)}********${trimmed.slice(-4)}`;
}

adminSettingsRouter.get(
  '/admin/settings',
  requireRole('admin'),
  (_req: Request, res: Response) => {
    const apiKeyMasked = maskApiKey(env.ANTHROPIC_API_KEY);
    const apiKeyConfigured = !!apiKeyMasked;
    res.json({
      configuredVia: 'environment',
      llm: {
        provider: env.LLM_PROVIDER,
        model: env.LLM_MODEL,
        enabled: env.LLM_ENABLED,
        apiKeyConfigured,
        ...(apiKeyMasked ? { apiKeyMasked } : {}),
      },
      rateLimits: {
        loginPerMinute: 10,
        registerPerHour: 5,
      },
      retention: {
        enabled: env.RETENTION_ENABLED,
      },
      registration: {
        allow: env.AUTH_ALLOW_REGISTRATION,
        defaultRole: env.AUTH_DEFAULT_ROLE,
      },
    });
  },
);
