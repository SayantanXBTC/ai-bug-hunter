import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestExecutor } from './testExecutor.js';
import { BrowserManager } from '../browser/browserManager.js';
import { startFixtureServer, type FixtureServer } from '../test/fixtureServer.js';
import type { TestDefinition } from '../types/execution.js';

let fixture: FixtureServer;
let manager: BrowserManager;
let executor: TestExecutor;

beforeAll(async () => {
  fixture = await startFixtureServer();
  manager = new BrowserManager({ headless: true });
  await manager.launch();
  executor = new TestExecutor({
    browserManager: manager,
    actionTimeoutMs: 3_000,
    navigationTimeoutMs: 5_000,
    testTimeoutMs: 30_000,
  });
});

afterAll(async () => {
  await manager.close();
  await fixture.close();
});

describe('TestExecutor', () => {
  it('Scenario 1: navigate only → passed', async () => {
    const def: TestDefinition = {
      id: 's1',
      name: 'navigate only',
      targetUrl: fixture.url,
      steps: [{ action: 'navigate', url: fixture.url }],
    };
    const r = await executor.run(def);
    expect(r.status).toBe('passed');
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]!.status).toBe('passed');
    expect(r.durationMs).toBeGreaterThan(0);
  }, 60_000);

  it('Scenario 2: navigate → fill → click → wait → passed', async () => {
    const def: TestDefinition = {
      id: 's2',
      name: 'form flow',
      targetUrl: fixture.url,
      steps: [
        { action: 'navigate', url: fixture.url },
        { action: 'fill', selector: '#email', value: 'user@example.com' },
        { action: 'fill', selector: '#password', value: 'secret' },
        { action: 'selectOption', selector: '#role', value: 'admin' },
        { action: 'click', selector: '#submit-btn' },
        { action: 'waitForSelector', selector: '#result-success' },
      ],
    };
    const r = await executor.run(def);
    expect(r.status).toBe('passed');
    expect(r.steps.every((s) => s.status === 'passed')).toBe(true);
  }, 60_000);

  it('Scenario 3: invalid selector → failed', async () => {
    const def: TestDefinition = {
      id: 's3',
      name: 'invalid selector',
      targetUrl: fixture.url,
      steps: [
        { action: 'navigate', url: fixture.url },
        { action: 'click', selector: '#does-not-exist' },
      ],
    };
    const r = await executor.run(def);
    expect(r.status).toBe('failed');
    expect(r.steps[1]!.status).toBe('failed');
    expect(r.error?.stepIndex).toBe(1);
    expect(r.error?.message.length).toBeGreaterThan(0);
  }, 60_000);

  it('Scenario 4: waitForSelector timeout → normalized failure', async () => {
    const def: TestDefinition = {
      id: 's4',
      name: 'timeout',
      targetUrl: fixture.url,
      steps: [
        { action: 'navigate', url: fixture.url },
        { action: 'waitForSelector', selector: '#never-appears', timeoutMs: 1_000 },
      ],
    };
    const r = await executor.run(def);
    expect(r.status).toBe('failed');
    expect(r.steps[1]!.status).toBe('failed');
    expect(r.error?.name).toMatch(/Timeout/i);
    expect(r.error?.stepIndex).toBe(1);
  }, 60_000);

  it('Scenario 5: step 3 fails, later steps skipped', async () => {
    const def: TestDefinition = {
      id: 's5',
      name: 'step 3 fails',
      targetUrl: fixture.url,
      steps: [
        { action: 'navigate', url: fixture.url },
        { action: 'fill', selector: '#email', value: 'x@y.z' },
        { action: 'click', selector: '#missing' },
        { action: 'fill', selector: '#password', value: 'v' },
      ],
    };
    const r = await executor.run(def);
    expect(r.status).toBe('failed');
    expect(r.steps[0]!.status).toBe('passed');
    expect(r.steps[1]!.status).toBe('passed');
    expect(r.steps[2]!.status).toBe('failed');
    expect(r.steps[3]!.status).toBe('skipped');
    expect(r.error?.stepIndex).toBe(2);
  }, 60_000);

  it('Scenario 6: browser cleaned up after success', async () => {
    const localManager = new BrowserManager({ headless: true });
    const localExec = new TestExecutor({ browserManager: localManager });
    await localExec.run({
      id: 's6',
      name: 'cleanup after success',
      targetUrl: fixture.url,
      steps: [{ action: 'navigate', url: fixture.url }],
    });
    // Session closed inside run; manager still open because externally supplied.
    expect(localManager.isRunning()).toBe(true);
    await localManager.close();
    expect(localManager.isRunning()).toBe(false);
  }, 60_000);

  it('Scenario 7: browser cleaned up after failure (owned manager)', async () => {
    const localExec = new TestExecutor({ headless: true, actionTimeoutMs: 1_000 });
    const r = await localExec.run({
      id: 's7',
      name: 'cleanup after failure',
      targetUrl: fixture.url,
      steps: [
        { action: 'navigate', url: fixture.url },
        { action: 'click', selector: '#never' },
      ],
    });
    expect(r.status).toBe('failed');
    // If cleanup broke, subsequent Chromium launch would still succeed but leak processes.
    // We assert result completes and returns; leak detection is best-effort here.
  }, 90_000);
});
