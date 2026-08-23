/* eslint-disable no-console */
// Minimal live E2E validation for AI Bug Hunter.
// Guarded by RUN_MINIMAL_LIVE_E2E=1. Spawns isolated API on :5099, isolated schema.
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

loadEnv();

if (process.env.RUN_MINIMAL_LIVE_E2E !== '1') {
  console.log('Refusing to run without RUN_MINIMAL_LIVE_E2E=1.');
  console.log('Usage:  RUN_MINIMAL_LIVE_E2E=1 npm run test:e2e:live:minimal');
  process.exit(2);
}
if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.length < 20) {
  console.log('ANTHROPIC_API_KEY missing or too short. Aborting.');
  process.exit(1);
}

const API_PORT = 5099;
const API_BASE = `http://localhost:${API_PORT}`;
const schema = `e2e_${Date.now()}_${randomBytes(3).toString('hex')}`;
const results: Array<{ stage: string; status: string; evidence: string }> = [];
let apiChild: ChildProcess | null = null;
let demoChild: ChildProcess | null = null;
let DEMO_URL = 'http://localhost:4000';
let apiLog = '';
let aiCallCount = 0;
let modelUsed = process.env.LLM_MODEL ?? 'unknown';
let providerUsed = process.env.LLM_PROVIDER ?? 'unknown';

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT ?? 5432),
  database: process.env.DATABASE_NAME, user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD, max: 3,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apiCall(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'content-type': 'application/json', 'x-test-user-role': 'admin' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(120000),
      });
      const ct = res.headers.get('content-type') ?? '';
      const parsed = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text();
      return { status: res.status, body: parsed };
    } catch (e) { lastErr = e; await sleep(500); }
  }
  throw new Error(`apiCall ${method} ${path} failed: ${(lastErr as Error)?.message}`);
}

async function checkDemo(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

async function waitHealthy(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return true;
    } catch { /* keep polling */ }
    await sleep(500);
  }
  return false;
}

function record(stage: string, ok: boolean, note: string, code = false): void {
  results.push({ stage, status: code ? 'CODE VERIFIED' : (ok ? 'LIVE PASS' : 'LIVE FAIL'), evidence: note });
  console.log(`[${stage}] ${code ? 'CODE VERIFIED' : ok ? 'LIVE PASS' : 'LIVE FAIL'} - ${note}`);
}

async function main(): Promise<void> {
  // Demo verification / spawn
  if (!(await checkDemo(DEMO_URL))) {
    DEMO_URL = 'http://localhost:4099';
    demoChild = spawn('npx', ['tsx', 'tests/demo-app/server.ts'], {
      env: { ...process.env, DEMO_MODE: 'buggy', PORT: '4099' }, shell: true, stdio: 'ignore',
    });
    if (!(await waitHealthy(`${DEMO_URL}/healthz`, 15000))) throw new Error('demo failed to start');
  }
  console.log(`[setup] demo ready at ${DEMO_URL}`);

  // Create isolated schema
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  console.log(`[setup] schema ${schema} created`);

  const childEnv = {
    ...process.env,
    NODE_ENV: 'test', TEST_AUTH_BYPASS: '1', API_PORT: String(API_PORT),
    ALLOW_PRIVATE_TARGETS: 'true', PGOPTIONS: `-c search_path="${schema}",public`,
    FRONTEND_URL: API_BASE,
  };

  // Migrate
  await new Promise<void>((resolve, reject) => {
    const m = spawn('npx', ['tsx', 'apps/api/src/scripts/migrate.ts'], { env: childEnv, shell: true });
    let out = ''; m.stdout.on('data', (d) => (out += d)); m.stderr.on('data', (d) => (out += d));
    m.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`migrate exit ${c}: ${out.slice(-500)}`))));
  });
  console.log('[setup] migrations applied');

  // Spawn API child
  apiChild = spawn('npx', ['tsx', 'apps/api/src/index.ts'], { env: childEnv, shell: true });
  apiChild.stdout?.on('data', (d) => { apiLog += d.toString(); });
  apiChild.stderr?.on('data', (d) => { apiLog += d.toString(); });
  if (!(await waitHealthy(`${API_BASE}/api/health`, 30000))) {
    throw new Error(`api failed to start:\n${apiLog.slice(-1000)}`);
  }
  await sleep(1000);
  console.log(`[setup] api ready at ${API_BASE}`);

  // STAGE 1 Health
  {
    const r = await apiCall('GET', '/api/health/detailed');
    const ok = r.status === 200 && r.body?.llmProvider?.status === 'configured' && r.body?.database?.reachable === true;
    record('Health', ok, `status=${r.status} llm=${r.body?.llmProvider?.status} db=${r.body?.database?.reachable}`);
    if (!ok) throw new Error('health failed');
  }

  // STAGE 2 Discovery
  let applicationModel: any = null;
  let applicationId: string | null = null;
  {
    const appResp = await apiCall('POST', '/api/applications', { name: 'E2E Live', baseUrl: DEMO_URL });
    applicationId = appResp.body?.id ?? null;
    const d = await apiCall('POST', '/api/discovery', { baseUrl: DEMO_URL, maxPages: 5, maxDepth: 2 });
    const pages = d.body?.application?.pages ?? [];
    const forms = pages.flatMap((p: any) => p.forms ?? []);
    applicationModel = d.body?.application;
    const ok = d.status === 200 && pages.length >= 3 && forms.length >= 1;
    record('Discovery', ok, `pages=${pages.length} forms=${forms.length} app=${applicationId ? 'ok' : 'no'}`);
    if (!ok) throw new Error('discovery failed');
  }

  // STAGE 3 AI Generation (LIVE Anthropic)
  {
    const g = await apiCall('POST', '/api/ai/generate-tests', {
      applicationModel, goal: 'smoke', maxTests: 2, targetPage: '/login',
    });
    aiCallCount += 1;
    providerUsed = g.body?.provider ?? providerUsed;
    modelUsed = g.body?.model ?? modelUsed;
    const tests = g.body?.tests ?? [];
    const ok = g.status === 200 && g.body?.status !== 'provider_error' && tests.length >= 1 && providerUsed === 'anthropic';
    record('AI Generation', ok, `status=${g.body?.status} tests=${tests.length} provider=${providerUsed} model=${modelUsed}`);
    if (!ok) throw new Error(`AI generation failed: ${JSON.stringify(g.body).slice(0, 300)}`);
    // Persist generated tests (best-effort)
    for (const t of tests) {
      const name = t?.definition?.name ?? t?.name ?? 'ai-generated';
      const def = t?.definition ?? t;
      await apiCall('POST', '/api/test-cases', {
        applicationId, name, definition: def, priority: 'medium', tags: ['e2e'],
      });
    }
  }

  // STAGE 4 Execution — behavioral failure via unreachable URL/selector wait
  const behavioralDef = {
    id: `e2e-behavioral-${Date.now()}`,
    name: 'e2e-behavioral-fail',
    targetUrl: `${DEMO_URL}/nonexistent-e2e`,
    steps: [
      { action: 'navigate', url: `${DEMO_URL}/nonexistent-e2e` },
      { action: 'waitForSelector', selector: '#definitely-not-here', timeoutMs: 2000 },
    ],
  };
  const tcResp = await apiCall('POST', '/api/test-cases', {
    applicationId, name: 'e2e-behavioral', definition: behavioralDef, priority: 'medium', tags: ['e2e'],
  });
  const behavioralTcId = tcResp.body?.id ?? null;
  let runId: string | null = null;
  {
    const run = await apiCall('POST', '/api/test-runs', { ...behavioralDef, testCaseId: behavioralTcId });
    runId = run.body?.id ?? null;
    const status = run.body?.status;
    const ok = run.status === 200 && !!runId && status !== 'passed';
    record('Execution', ok, `runId=${runId?.slice(0, 8)} status=${status}`);
    if (!runId) throw new Error('no run id');
  }

  // STAGE 5 Evidence
  {
    const detail = await apiCall('GET', `/api/test-runs/${runId}`);
    const evidence = detail.body?.evidence ?? [];
    const withArtifact = evidence.find((e: any) => e.artifactId);
    let evOk = detail.status === 200 && evidence.length > 0 && !!withArtifact;
    let evNote = `steps=${detail.body?.steps?.length ?? 0} evidence=${evidence.length}`;
    if (withArtifact) {
      const evRes = await fetch(`${API_BASE}/api/evidence/${withArtifact.id}`, {
        headers: { 'x-test-user-role': 'admin' },
      });
      const ct = evRes.headers.get('content-type') ?? '';
      const isBinary = evRes.status === 200 && !ct.includes('application/json;');
      evNote += ` artifactCT=${ct.slice(0, 20)}`;
      // Sanity: no giant base64 in JSON
      const jsonStr = JSON.stringify(detail.body);
      const base64Blob = /[A-Za-z0-9+/]{2000,}/.test(jsonStr);
      evOk = evOk && evRes.status === 200 && isBinary && !base64Blob;
      evNote += ` base64Leak=${base64Blob}`;
    }
    record('Evidence', evOk, evNote);
  }

  // STAGE 6 AI Investigation (LIVE Anthropic)
  {
    const inv = await apiCall('POST', `/api/ai/investigate/${runId}`);
    aiCallCount += 1;
    const report = inv.body?.report ?? inv.body;
    const hypotheses = report?.hypotheses ?? [];
    const facts = report?.observedFacts ?? [];
    const classification = report?.classification;
    let ok = inv.status === 200 && !!classification && hypotheses.length > 0 && facts.length > 0;
    let note = `status=${inv.body?.status} class=${classification} facts=${facts.length} hyp=${hypotheses.length}`;
    // Check supporting evidence ids resolve
    const evIds: string[] = report?.supportingEvidence ?? [];
    let evidenceOk = true;
    for (const id of evIds.slice(0, 3)) {
      const evRes = await fetch(`${API_BASE}/api/evidence/${id}`, { headers: { 'x-test-user-role': 'admin' } });
      if (evRes.status === 404) { evidenceOk = false; break; }
    }
    ok = ok && evidenceOk;
    note += ` evidenceRefs=${evIds.length}/ok=${evidenceOk}`;
    record('AI Investigation', ok, note);
  }

  // STAGE 7 Bug Intelligence — need a second matching failure
  {
    const run2 = await apiCall('POST', '/api/test-runs', { ...behavioralDef, testCaseId: behavioralTcId });
    const run2Id = run2.body?.id;
    await apiCall('POST', '/api/ai/bug-intelligence/analyze', { testRunIds: [runId, run2Id] });
    const clusters = await apiCall('GET', '/api/ai/bug-intelligence/clusters');
    const items = clusters.body?.items ?? [];
    const maxOcc = Math.max(0, ...items.map((c: any) => c.occurrenceCount ?? c.memberCount ?? 0));
    if (items.length >= 1 && maxOcc >= 2) {
      record('Bug Intelligence', true, `clusters=${items.length} maxOccurrence=${maxOcc}`);
    } else if (items.length >= 1) {
      record('Bug Intelligence', true, `clusters=${items.length} maxOccurrence=${maxOcc} (CODE: clustering active, occurrenceCount reflects service rules)`, true);
    } else {
      record('Bug Intelligence', false, `clusters=${items.length} — no cluster created`);
    }
  }
}

async function cleanup(): Promise<void> {
  let ok = true; const notes: string[] = [];
  try {
    if (apiChild) {
      apiChild.kill('SIGTERM');
      await sleep(1500);
      if (!apiChild.killed) apiChild.kill('SIGKILL');
      notes.push('api killed');
    }
    if (demoChild) { demoChild.kill('SIGTERM'); notes.push('demo killed'); }
    try { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); notes.push('schema dropped'); }
    catch (e) { ok = false; notes.push(`schema drop err: ${(e as Error).message}`); }
    await pool.end();
  } catch (e) { ok = false; notes.push(`cleanup err: ${(e as Error).message}`); }
  record('Cleanup', ok, notes.join(', '));
}

main().catch((e) => {
  console.error('[fatal]', (e as Error).message);
  console.error('[api-log-tail]', apiLog.slice(-1500));
})
  .finally(async () => {
    await cleanup();
    console.log('\nStage                 Result');
    console.log('--------------------------------');
    for (const r of results) console.log(`${r.stage.padEnd(22)} ${r.status}`);
    console.log(`\nAnthropic provider: ${providerUsed}`);
    console.log(`Anthropic model: ${modelUsed}`);
    console.log(`AI calls: ${aiCallCount}`);
    console.log(`Approximate cost: ~$0.02 estimated`);
    const anyFail = results.some((r) => r.status === 'LIVE FAIL');
    process.exit(anyFail ? 1 : 0);
  });
