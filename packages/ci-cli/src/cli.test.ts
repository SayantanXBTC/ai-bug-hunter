import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCampaign,
  fetchResult,
  loadOptions,
  parseArgs,
  pollUntilComplete,
  redactAuth,
  run,
  summarize,
} from './cli.js';

const TOKEN = 'ci_tok_secret_12345';
const BASE_ENV = {
  AI_BUG_HUNTER_URL: 'http://localhost:5000',
  AI_BUG_HUNTER_CI_TOKEN: TOKEN,
};

describe('parseArgs', () => {
  it('parses positional campaignId', () => {
    expect(parseArgs(['regression', 'cid-1'])).toMatchObject({
      command: 'regression',
      campaignId: 'cid-1',
    });
  });
  it('parses flags', () => {
    const p = parseArgs(['regression', '--application', 'a1', '--strategy', 'risk_based', '--wait']);
    expect(p).toMatchObject({
      applicationId: 'a1',
      strategy: 'risk_based',
      wait: true,
    });
  });
  it('rejects unknown command', () => {
    expect(() => parseArgs(['whatever'])).toThrow();
  });
});

describe('redactAuth', () => {
  it('replaces token with ***', () => {
    expect(redactAuth(`Bearer ${TOKEN} failed`, TOKEN)).toBe('Bearer *** failed');
  });
  it('is a no-op for empty token', () => {
    expect(redactAuth('hello', '')).toBe('hello');
  });
});

describe('loadOptions', () => {
  it('requires token', () => {
    expect(() => loadOptions({})).toThrow(/AI_BUG_HUNTER_CI_TOKEN/);
  });
  it('applies defaults', () => {
    const o = loadOptions({ AI_BUG_HUNTER_CI_TOKEN: 't' });
    expect(o.baseUrl).toBe('http://localhost:5000');
    expect(o.pollMs).toBe(5000);
  });
});

describe('fetch flows', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('createCampaign posts and returns id', async () => {
    const mock = vi.fn(async () =>
      new Response(JSON.stringify({ campaignId: 'cid-new', status: 'queued' }), { status: 202 }),
    );
    global.fetch = mock as unknown as typeof fetch;
    const opts = loadOptions(BASE_ENV);
    const r = await createCampaign(opts, { strategy: 'risk_based' });
    expect(r.campaignId).toBe('cid-new');
    expect(mock).toHaveBeenCalledOnce();
    const [, init] = mock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      authorization: `Bearer ${TOKEN}`,
    });
  });

  it('fetchResult returns parsed result', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          campaignId: 'c1',
          status: 'passed',
          quality: 'healthy',
          passed: 3,
          failed: 0,
          errors: 0,
          exitCode: 0,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const r = await fetchResult(loadOptions(BASE_ENV), 'c1');
    expect(r.status).toBe('passed');
    expect(r.exitCode).toBe(0);
  });

  it('pollUntilComplete polls until terminal', async () => {
    let n = 0;
    global.fetch = vi.fn(async () => {
      n += 1;
      const body =
        n < 3
          ? { campaignId: 'c1', status: 'running', quality: null, passed: 0, failed: 0, errors: 0, exitCode: 2 }
          : { campaignId: 'c1', status: 'passed', quality: 'healthy', passed: 2, failed: 0, errors: 0, exitCode: 0 };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const opts = { ...loadOptions(BASE_ENV), pollMs: 0, timeoutMs: 10_000 };
    const r = await pollUntilComplete(opts, 'c1', async () => undefined);
    expect(r.status).toBe('passed');
    expect(n).toBe(3);
  });

  it('run polls existing campaign and returns exit code', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          campaignId: 'cid-x',
          status: 'failed',
          quality: 'failed',
          passed: 1,
          failed: 2,
          errors: 0,
          exitCode: 1,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const code = await run(['regression', 'cid-x'], { ...BASE_ENV, AI_BUG_HUNTER_POLL_MS: '0' });
    expect(code).toBe(1);
    const out = spy.mock.calls.flat().join('\n');
    expect(out).not.toContain(TOKEN);
    spy.mockRestore();
  });

  it('token never appears in stdout on error', async () => {
    global.fetch = vi.fn(async () =>
      new Response(`nope Bearer ${TOKEN}`, { status: 500 }),
    ) as unknown as typeof fetch;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let threw: Error | null = null;
    try {
      await fetchResult(loadOptions(BASE_ENV), 'c1');
    } catch (e) {
      threw = e as Error;
    }
    expect(threw?.message ?? '').not.toContain(TOKEN);
    expect(threw?.message ?? '').toContain('***');
    errSpy.mockRestore();
  });
});

describe('summarize', () => {
  it('produces multi-line summary', () => {
    const s = summarize({
      campaignId: 'c1',
      status: 'passed',
      quality: 'healthy',
      passed: 2,
      failed: 0,
      errors: 0,
      exitCode: 0,
    });
    expect(s).toContain('campaign: c1');
    expect(s).toContain('exitCode: 0');
  });
});
