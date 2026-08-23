import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
import type {
  ArtifactStore,
  ArtifactStoreInput,
  StoredArtifact,
} from './artifactStore.js';

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': '.png',
  'text/html': '.html',
  'application/json': '.json',
  'text/plain': '.txt',
};

export class LocalArtifactStore implements ArtifactStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private resolveKey(storageKey: string): string {
    // Storage keys are server-generated: "<sha256[0..2]>/<uuid><ext>".
    if (isAbsolute(storageKey) || storageKey.includes('..') || storageKey.includes('\0')) {
      throw new Error('Invalid storage key');
    }
    const abs = resolve(this.root, storageKey);
    const rootWithSep = this.root.endsWith(sep) ? this.root : this.root + sep;
    if (!abs.startsWith(rootWithSep)) {
      throw new Error('Storage key escapes artifact root');
    }
    return abs;
  }

  async save(input: ArtifactStoreInput): Promise<StoredArtifact> {
    const sha256 = createHash('sha256').update(input.content).digest('hex');
    const ext = input.extension ?? EXT_BY_TYPE[input.contentType] ?? '';
    const storageKey = `${sha256.slice(0, 2)}/${randomUUID()}${ext}`;
    const abs = this.resolveKey(storageKey);
    await mkdir(resolve(abs, '..'), { recursive: true });
    await writeFile(abs, input.content);
    return {
      storageKey,
      contentType: input.contentType,
      byteSize: input.content.byteLength,
      sha256,
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    return await readFile(this.resolveKey(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveKey(storageKey));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  getRoot(): string {
    return this.root;
  }
}
