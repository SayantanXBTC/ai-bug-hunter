export interface ArtifactStoreInput {
  content: Buffer;
  contentType: string;
  extension?: string;
}

export interface StoredArtifact {
  storageKey: string;
  contentType: string;
  byteSize: number;
  sha256: string;
}

export interface ArtifactStore {
  save(input: ArtifactStoreInput): Promise<StoredArtifact>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}
