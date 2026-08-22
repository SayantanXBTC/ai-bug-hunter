import { describe, it, expect, afterAll } from 'vitest';
import { BrowserManager } from './browserManager.js';

const manager = new BrowserManager({ headless: true });

afterAll(async () => {
  await manager.close();
});

describe('BrowserManager', () => {
  it('is idle before launch', () => {
    expect(manager.isRunning()).toBe(false);
  });

  it('launches and creates a session', async () => {
    await manager.launch();
    expect(manager.isRunning()).toBe(true);

    const session = await manager.createSession();
    expect(session.page).toBeDefined();
    expect(session.context).toBeDefined();

    await session.close();
  }, 60_000);

  it('closes cleanly', async () => {
    await manager.close();
    expect(manager.isRunning()).toBe(false);
  }, 30_000);
});
