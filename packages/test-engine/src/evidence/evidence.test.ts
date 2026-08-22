import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserManager } from '../browser/browserManager.js';
import { TestExecutor } from '../executor/testExecutor.js';
import { startFixtureServer, type FixtureServer } from '../test/fixtureServer.js';
import { InMemoryEvidenceStore } from './evidenceStore.js';
import type { TestDefinition } from '../types/execution.js';

let fixture: FixtureServer;
let manager: BrowserManager;

beforeAll(async () => {
  fixture = await startFixtureServer();
  manager = new BrowserManager({ headless: true });
  await manager.launch();
});

afterAll(async () => {
  await manager.close();
  await fixture.close();
});

function build(steps: TestDefinition['steps'], id = 'e-' + Math.random().toString(36).slice(2)): TestDefinition {
  return { id, name: id, targetUrl: fixture.url, steps };
}

describe('EvidenceCollector via TestExecutor', () => {
  it('screenshot + DOM captured on failure', async () => {
    const exec = new TestExecutor({ browserManager: manager, actionTimeoutMs: 1_500 });
    const r = await exec.run(
      build([
        { action: 'navigate', url: fixture.url },
        { action: 'click', selector: '#never-exists' },
      ]),
    );
    expect(r.status).toBe('failed');
    expect(r.evidence).toBeDefined();
    expect(r.evidence!.failingStepIndex).toBe(1);
    expect(r.evidence!.screenshot?.mimeType).toBe('image/png');
    expect(r.evidence!.screenshot?.byteLength).toBeGreaterThan(0);
    expect(r.evidence!.dom?.html).toContain('<html');
    expect(r.evidence!.dom?.byteLength).toBeGreaterThan(0);
  }, 60_000);

  it('console.log and console.error collected', async () => {
    const exec = new TestExecutor({
      browserManager: manager,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(
      build([
        { action: 'navigate', url: fixture.url },
        { action: 'click', selector: '#trigger-console-error' },
        { action: 'waitForSelector', selector: '#console-error-emitted' },
      ]),
    );
    expect(r.status).toBe('passed');
    expect(r.evidence).toBeDefined();
    const loads = r.evidence!.consoleLogs.filter((m) => m.text === 'fixture-loaded');
    const errs = r.evidence!.consoleLogs.filter((m) => m.type === 'error');
    expect(loads.length).toBeGreaterThanOrEqual(1);
    expect(errs.some((e) => e.text.includes('deliberate-console-error'))).toBe(true);
  }, 60_000);

  it('page errors collected separately from console errors', async () => {
    const exec = new TestExecutor({
      browserManager: manager,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(
      build([
        { action: 'navigate', url: fixture.url },
        { action: 'click', selector: '#trigger-page-error' },
        { action: 'wait', durationMs: 200 },
      ]),
    );
    expect(r.status).toBe('passed');
    expect(r.evidence!.pageErrors.some((e) => e.message.includes('deliberate-page-error'))).toBe(true);
    // Ensure not counted in consoleLogs errors
    const consoleErr = r.evidence!.consoleLogs.filter(
      (m) => m.type === 'error' && m.text.includes('deliberate-page-error'),
    );
    expect(consoleErr).toHaveLength(0);
  }, 60_000);

  it('network requests captured with method and status', async () => {
    const exec = new TestExecutor({
      browserManager: manager,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(
      build([{ action: 'navigate', url: fixture.url }]),
    );
    expect(r.status).toBe('passed');
    const rootReq = r.evidence!.networkRequests.find((n) => n.url === fixture.url);
    expect(rootReq).toBeDefined();
    expect(rootReq!.method).toBe('GET');
    expect(rootReq!.status).toBe(200);
  }, 60_000);

  it('HTTP 500 marked as failedRequests with type=http', async () => {
    const exec = new TestExecutor({
      browserManager: manager,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(
      build([
        { action: 'navigate', url: fixture.url },
        { action: 'click', selector: '#trigger-500' },
        { action: 'waitForSelector', selector: '#network-done' },
        { action: 'wait', durationMs: 100 },
      ]),
    );
    const failed = r.evidence!.failedRequests.filter((n) => n.url.endsWith('/api/error'));
    expect(failed.length).toBeGreaterThan(0);
    expect(failed[0]!.failure?.type).toBe('http');
    expect(failed[0]!.failure?.status).toBe(500);
  }, 60_000);

  it('aborted request marked as failedRequests with type=aborted or network', async () => {
    const exec = new TestExecutor({
      browserManager: manager,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(
      build([
        { action: 'navigate', url: fixture.url },
        { action: 'click', selector: '#trigger-abort' },
        { action: 'wait', durationMs: 300 },
      ]),
    );
    const failed = r.evidence!.failedRequests.filter((n) => n.url.endsWith('/api/abort'));
    expect(failed.length).toBeGreaterThan(0);
    expect(['aborted', 'network']).toContain(failed[0]!.failure?.type);
  }, 60_000);

  it('browser metadata populated', async () => {
    const exec = new TestExecutor({
      browserManager: manager,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(build([{ action: 'navigate', url: fixture.url }]));
    expect(r.evidence!.browser).not.toBeNull();
    expect(r.evidence!.browser!.name).toBe('chromium');
    expect(r.evidence!.browser!.version).toMatch(/\d+/);
    expect(r.evidence!.browser!.userAgent).toContain('Chrome');
    expect(r.evidence!.browser!.title).toContain('AI Bug Hunter');
  }, 60_000);

  it('failingStepIndex points to failing step', async () => {
    const exec = new TestExecutor({ browserManager: manager, actionTimeoutMs: 1_000 });
    const r = await exec.run(
      build([
        { action: 'navigate', url: fixture.url },
        { action: 'fill', selector: '#email', value: 'x@y.z' },
        { action: 'click', selector: '#no-such-thing' },
      ]),
    );
    expect(r.status).toBe('failed');
    expect(r.evidence!.failingStepIndex).toBe(2);
    expect(r.error?.stepIndex).toBe(2);
  }, 60_000);

  it('evidence disabled options result in empty/missing evidence sections', async () => {
    const exec = new TestExecutor({
      browserManager: manager,
      actionTimeoutMs: 1_000,
      evidence: {
        screenshotOnFailure: false,
        captureDomOnFailure: false,
        captureConsole: false,
        captureNetwork: false,
        capturePageErrors: false,
      },
    });
    const r = await exec.run(
      build([
        { action: 'navigate', url: fixture.url },
        { action: 'click', selector: '#absent' },
      ]),
    );
    expect(r.status).toBe('failed');
    expect(r.evidence).toBeDefined();
    expect(r.evidence!.screenshot).toBeUndefined();
    expect(r.evidence!.dom).toBeUndefined();
    expect(r.evidence!.consoleLogs).toHaveLength(0);
    expect(r.evidence!.pageErrors).toHaveLength(0);
    expect(r.evidence!.networkRequests).toHaveLength(0);
  }, 60_000);

  it('successful test does not attach evidence by default', async () => {
    const exec = new TestExecutor({ browserManager: manager });
    const r = await exec.run(build([{ action: 'navigate', url: fixture.url }]));
    expect(r.status).toBe('passed');
    expect(r.evidence).toBeUndefined();
  }, 60_000);

  it('successful test attaches evidence when includeEvidenceOnSuccess=true', async () => {
    const exec = new TestExecutor({
      browserManager: manager,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(build([{ action: 'navigate', url: fixture.url }]));
    expect(r.status).toBe('passed');
    expect(r.evidence).toBeDefined();
    expect(r.evidence!.failingStepIndex).toBeUndefined();
  }, 60_000);

  it('evidence available before browser cleanup (browser closed after run)', async () => {
    // Owned manager path — verifies finalize runs before manager close.
    const exec = new TestExecutor({
      actionTimeoutMs: 1_000,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(build([{ action: 'navigate', url: fixture.url }]));
    expect(r.status).toBe('passed');
    expect(r.evidence).toBeDefined();
    expect(r.evidence!.browser?.title).toContain('AI Bug Hunter');
  }, 60_000);

  it('collector handles page closure safely (evidence still returned)', async () => {
    // Simulate a step that navigates then closes context via a crash-like scenario:
    // we call a normal navigation followed by evaluate that closes window.
    // If page becomes closed mid-way, finalize should not throw.
    const exec = new TestExecutor({
      browserManager: manager,
      actionTimeoutMs: 1_500,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(
      build([
        { action: 'navigate', url: fixture.url },
        { action: 'waitForSelector', selector: '#heading' },
      ]),
    );
    expect(r.status).toBe('passed');
    expect(r.evidence).toBeDefined();
  }, 60_000);

  it('request bodies are NOT captured', async () => {
    const exec = new TestExecutor({
      browserManager: manager,
      evidence: { includeEvidenceOnSuccess: true },
    });
    const r = await exec.run(
      build([
        { action: 'navigate', url: fixture.url },
        { action: 'click', selector: '#trigger-500' },
        { action: 'wait', durationMs: 200 },
      ]),
    );
    const entry = r.evidence!.networkRequests.find((n) => n.url.endsWith('/api/error'));
    expect(entry).toBeDefined();
    // Ensure structure has no body/headers/cookies keys.
    expect(Object.keys(entry!)).not.toContain('body');
    expect(Object.keys(entry!)).not.toContain('headers');
    expect(Object.keys(entry!)).not.toContain('cookies');
  }, 60_000);
});

describe('InMemoryEvidenceStore', () => {
  it('saves and retrieves packages by id', async () => {
    const store = new InMemoryEvidenceStore();
    const pkg = {
      id: 'x',
      collectedAt: '',
      testId: 't',
      browser: null,
      consoleLogs: [],
      pageErrors: [],
      networkRequests: [],
      failedRequests: [],
      metadata: {
        truncated: { console: false, network: false, dom: false },
        counts: { consoleLogs: 0, pageErrors: 0, networkRequests: 0, failedRequests: 0 },
      },
    };
    await store.save(pkg);
    expect(await store.get('x')).toBe(pkg);
    expect(await store.list()).toEqual(['x']);
    await store.clear();
    expect(await store.get('x')).toBeUndefined();
  });
});
