import type { EvidencePackage } from './evidenceTypes.js';

export interface EvidenceStore {
  save(pkg: EvidencePackage): Promise<void>;
  get(id: string): Promise<EvidencePackage | undefined>;
  list(): Promise<string[]>;
  clear(): Promise<void>;
}

export class InMemoryEvidenceStore implements EvidenceStore {
  private readonly items = new Map<string, EvidencePackage>();

  async save(pkg: EvidencePackage): Promise<void> {
    this.items.set(pkg.id, pkg);
  }

  async get(id: string): Promise<EvidencePackage | undefined> {
    return this.items.get(id);
  }

  async list(): Promise<string[]> {
    return Array.from(this.items.keys());
  }

  async clear(): Promise<void> {
    this.items.clear();
  }
}
