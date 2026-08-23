#!/usr/bin/env node
/**
 * AI Bug Hunter CI CLI.
 *
 * Usage:
 *   ai-bug-hunter-ci regression <campaignId>
 *   ai-bug-hunter-ci regression --application <appId> --strategy risk_based [--max-tests N] [--wait]
 *
 * Env:
 *   AI_BUG_HUNTER_URL       (default http://localhost:5000)
 *   AI_BUG_HUNTER_CI_TOKEN  (required)
 *   AI_BUG_HUNTER_TIMEOUT_MS (poll timeout — default 1800000 = 30 min)
 *   AI_BUG_HUNTER_POLL_MS    (poll interval — default 5000)
 */

export interface CliOptions {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  pollMs: number;
}

export interface RegressionResult {
  campaignId: string;
  status: string;
  quality: string | null;
  passed: number;
  failed: number;
  errors: number;
  regressions?: number;
  flakyTests?: number;
  totalTests?: number;
  exitCode: number;
}

export interface ParsedArgs {
  command: 'regression';
  campaignId?: string;
  applicationId?: string;
  strategy?: string;
  maxTests?: number;
  wait?: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [cmd, ...rest] = argv;
  if (cmd !== 'regression') {
    throw new Error(`unknown command: ${cmd ?? '<none>'}`);
  }
  const out: ParsedArgs = { command: 'regression' };
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === undefined) continue;
    if (a === '--application') {
      const v = rest[++i];
      if (!v) throw new Error('--application requires a value');
      out.applicationId = v;
    } else if (a === '--strategy') {
      const v = rest[++i];
      if (!v) throw new Error('--strategy requires a value');
      out.strategy = v;
    } else if (a === '--max-tests') {
      const v = rest[++i];
      if (!v) throw new Error('--max-tests requires a value');
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) throw new Error('--max-tests must be positive integer');
      out.maxTests = Math.floor(n);
    } else if (a === '--wait') {
      out.wait = true;
    } else if (a.startsWith('--')) {
      throw new Error(`unknown option: ${a}`);
    } else {
      positional.push(a);
    }
  }
  if (positional[0]) out.campaignId = positional[0];
  return out;
}

export function redactAuth(text: string, token: string): string {
  if (!token) return text;
  return text.split(token).join('***');
}

/** Perform a request, redacting the token from any error we may surface. */
async function safeFetch(
  url: string,
  init: RequestInit,
  token: string,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`request failed: ${redactAuth(msg, token)}`);
  }
}

export async function createCampaign(
  opts: CliOptions,
  body: { applicationId?: string; strategy: string; maxTests?: number },
): Promise<{ campaignId: string }> {
  const res = await safeFetch(
    `${opts.baseUrl}/api/ci/regression`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.token}`,
      },
      body: JSON.stringify(body),
    },
    opts.token,
  );
  const text = await res.text();
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(
      `POST /api/ci/regression failed: ${res.status} ${redactAuth(text, opts.token)}`,
    );
  }
  let json: { campaignId?: string };
  try {
    json = JSON.parse(text) as { campaignId?: string };
  } catch {
    throw new Error('invalid JSON from server');
  }
  if (!json.campaignId) throw new Error('server did not return campaignId');
  return { campaignId: json.campaignId };
}

export async function fetchResult(
  opts: CliOptions,
  campaignId: string,
): Promise<RegressionResult> {
  const res = await safeFetch(
    `${opts.baseUrl}/api/ci/regression/${encodeURIComponent(campaignId)}/result`,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${opts.token}` },
    },
    opts.token,
  );
  const text = await res.text();
  if (res.status !== 200) {
    throw new Error(`GET result failed: ${res.status} ${redactAuth(text, opts.token)}`);
  }
  return JSON.parse(text) as RegressionResult;
}

function isTerminal(result: RegressionResult): boolean {
  return (
    result.status === 'passed' ||
    result.status === 'failed' ||
    result.status === 'error' ||
    result.status === 'cancelled'
  );
}

export async function pollUntilComplete(
  opts: CliOptions,
  campaignId: string,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => number = Date.now,
): Promise<RegressionResult> {
  const deadline = now() + opts.timeoutMs;
   
  while (true) {
    const r = await fetchResult(opts, campaignId);
    if (isTerminal(r)) return r;
    if (now() >= deadline) {
      return { ...r, exitCode: 2, status: 'timeout' };
    }
    await sleep(opts.pollMs);
  }
}

export function summarize(r: RegressionResult): string {
  return [
    `campaign: ${r.campaignId}`,
    `status:   ${r.status}`,
    `quality:  ${r.quality ?? 'unknown'}`,
    `passed:   ${r.passed}`,
    `failed:   ${r.failed}`,
    `errors:   ${r.errors}`,
    `exitCode: ${r.exitCode}`,
  ].join('\n');
}

export function loadOptions(env: NodeJS.ProcessEnv): CliOptions {
  const token = env.AI_BUG_HUNTER_CI_TOKEN ?? '';
  if (!token) throw new Error('AI_BUG_HUNTER_CI_TOKEN is required');
  return {
    baseUrl: (env.AI_BUG_HUNTER_URL ?? 'http://localhost:5000').replace(/\/$/, ''),
    token,
    timeoutMs: Number(env.AI_BUG_HUNTER_TIMEOUT_MS ?? 30 * 60 * 1000),
    pollMs: Number(env.AI_BUG_HUNTER_POLL_MS ?? 5000),
  };
}

export async function run(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const args = parseArgs(argv);
  const opts = loadOptions(env);

  let campaignId = args.campaignId;
  if (!campaignId) {
    if (!args.strategy) throw new Error('--strategy is required when campaignId is omitted');
    const body: { applicationId?: string; strategy: string; maxTests?: number } = {
      strategy: args.strategy,
    };
    if (args.applicationId) body.applicationId = args.applicationId;
    if (args.maxTests !== undefined) body.maxTests = args.maxTests;
    const created = await createCampaign(opts, body);
    campaignId = created.campaignId;
     
    console.log(`created campaign ${campaignId}`);
    if (!args.wait) {
       
      console.log('not waiting (pass --wait to poll for completion)');
      return 0;
    }
  }

  const result = await pollUntilComplete(opts, campaignId);
   
  console.log(summarize(result));
  return result.exitCode;
}

const isDirectRun = (() => {
  try {
    const argv1 = process.argv[1] ?? '';
    return argv1.replace(/\\/g, '/').endsWith('/cli.ts') || argv1.replace(/\\/g, '/').endsWith('/cli.js');
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  run(process.argv.slice(2), process.env).then(
    (code) => process.exit(code),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // Best-effort redact — token may or may not be loaded
      const token = process.env.AI_BUG_HUNTER_CI_TOKEN ?? '';
       
      console.error(`error: ${redactAuth(msg, token)}`);
      process.exit(2);
    },
  );
}
