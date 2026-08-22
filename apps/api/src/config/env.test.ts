import { describe, it, expect } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults when nothing set', () => {
    const cfg = loadEnv({});
    expect(cfg.API_PORT).toBe(5000);
    expect(cfg.DATABASE_NAME).toBe('ai_bug_hunter');
    expect(cfg.NODE_ENV).toBe('development');
  });

  it('coerces numeric strings', () => {
    const cfg = loadEnv({ API_PORT: '8080', DATABASE_PORT: '6543' });
    expect(cfg.API_PORT).toBe(8080);
    expect(cfg.DATABASE_PORT).toBe(6543);
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/Invalid environment/);
  });

  it('rejects invalid FRONTEND_URL', () => {
    expect(() => loadEnv({ FRONTEND_URL: 'not-a-url' })).toThrow(/Invalid environment/);
  });
});
