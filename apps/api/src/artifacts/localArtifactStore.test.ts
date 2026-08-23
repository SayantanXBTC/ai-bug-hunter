import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalArtifactStore } from './localArtifactStore.js';

async function make() {
  const dir = await mkdtemp(join(tmpdir(), 'aibh-store-'));
  return {
    store: new LocalArtifactStore(dir),
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

describe('LocalArtifactStore', () => {
  it('saves and reads back binary content, computes sha256', async () => {
    const { store, cleanup } = await make();
    try {
      const buf = Buffer.from('hello world');
      const saved = await store.save({ content: buf, contentType: 'text/plain' });
      expect(saved.byteSize).toBe(11);
      expect(saved.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(saved.storageKey).toContain('/');
      const read = await store.read(saved.storageKey);
      expect(read.toString()).toBe('hello world');
    } finally {
      await cleanup();
    }
  });

  it('rejects path traversal in storage key', async () => {
    const { store, cleanup } = await make();
    try {
      await expect(store.read('../etc/passwd')).rejects.toThrow(/Invalid storage key/);
      await expect(store.read('..\\..\\evil')).rejects.toThrow(/Invalid storage key/);
    } finally {
      await cleanup();
    }
  });

  it('rejects absolute paths', async () => {
    const { store, cleanup } = await make();
    try {
      await expect(store.read('/etc/passwd')).rejects.toThrow(/Invalid storage key/);
    } finally {
      await cleanup();
    }
  });
});
