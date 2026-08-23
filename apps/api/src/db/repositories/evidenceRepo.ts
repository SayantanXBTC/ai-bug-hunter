import type { Pool, PoolClient } from 'pg';

export type EvidenceType =
  | 'screenshot'
  | 'dom'
  | 'console'
  | 'page_error'
  | 'network'
  | 'browser_metadata';

export interface ArtifactRecord {
  id: string;
  storage_key: string;
  content_type: string;
  byte_size: string; // bigint returned as string
  sha256: string;
  created_at: Date;
}

export interface EvidenceRecord {
  id: string;
  test_run_id: string;
  test_run_step_id: string | null;
  evidence_type: EvidenceType;
  artifact_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

type Executor = Pool | PoolClient;

export async function insertArtifact(
  exec: Executor,
  input: { storageKey: string; contentType: string; byteSize: number; sha256: string },
): Promise<ArtifactRecord> {
  const { rows } = await exec.query<ArtifactRecord>(
    `INSERT INTO artifacts (storage_key, content_type, byte_size, sha256)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [input.storageKey, input.contentType, input.byteSize, input.sha256],
  );
  return rows[0]!;
}

export async function getArtifactById(
  exec: Executor,
  id: string,
): Promise<ArtifactRecord | null> {
  const { rows } = await exec.query<ArtifactRecord>('SELECT * FROM artifacts WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function insertEvidence(
  exec: Executor,
  input: {
    testRunId: string;
    testRunStepId?: string | null;
    evidenceType: EvidenceType;
    artifactId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<EvidenceRecord> {
  const { rows } = await exec.query<EvidenceRecord>(
    `INSERT INTO evidence (test_run_id, test_run_step_id, evidence_type, artifact_id, metadata)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      input.testRunId,
      input.testRunStepId ?? null,
      input.evidenceType,
      input.artifactId ?? null,
      input.metadata ?? {},
    ],
  );
  return rows[0]!;
}

export async function listEvidenceForRun(
  exec: Executor,
  testRunId: string,
): Promise<EvidenceRecord[]> {
  const { rows } = await exec.query<EvidenceRecord>(
    'SELECT * FROM evidence WHERE test_run_id = $1 ORDER BY created_at ASC',
    [testRunId],
  );
  return rows;
}

export async function getEvidenceById(
  exec: Executor,
  id: string,
): Promise<EvidenceRecord | null> {
  const { rows } = await exec.query<EvidenceRecord>('SELECT * FROM evidence WHERE id = $1', [id]);
  return rows[0] ?? null;
}
