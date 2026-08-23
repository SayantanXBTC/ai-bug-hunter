import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockGetEvidence = vi.fn();
const mockGetArtifact = vi.fn();
const mockRead = vi.fn();

vi.mock('../db/pool.js', () => ({
  pool: {},
  pingDatabase: vi.fn(async () => ({ reachable: true, latencyMs: 1 })),
  closePool: vi.fn(async () => {}),
  createPool: vi.fn(),
}));

vi.mock('../db/repositories/evidenceRepo.js', () => ({
  getEvidenceById: (...args: unknown[]) => mockGetEvidence(...args),
  getArtifactById: (...args: unknown[]) => mockGetArtifact(...args),
  insertArtifact: vi.fn(),
  insertEvidence: vi.fn(),
  listEvidenceForRun: vi.fn(),
}));

vi.mock('../artifacts/localArtifactStore.js', () => ({
  LocalArtifactStore: class {
    async read(key: string): Promise<Buffer> {
      return mockRead(key);
    }
  },
}));

const { createApp } = await import('../app.js');

beforeEach(() => vi.clearAllMocks());

describe('GET /api/evidence/:id', () => {
  it('400 for non-UUID id', async () => {
    const app = createApp();
    const res = await request(app).get('/api/evidence/not-uuid');
    expect(res.status).toBe(400);
  });

  it('400 for path-traversal-looking id (still non-UUID)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/evidence/..%2F..%2Fetc%2Fpasswd');
    expect(res.status).toBe(400);
  });

  it('404 when evidence not found', async () => {
    mockGetEvidence.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).get('/api/evidence/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('404 when evidence has no artifact', async () => {
    mockGetEvidence.mockResolvedValueOnce({
      id: '0',
      test_run_id: 'r',
      test_run_step_id: null,
      evidence_type: 'console',
      artifact_id: null,
      metadata: {},
      created_at: new Date(),
    });
    const app = createApp();
    const res = await request(app).get('/api/evidence/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('returns artifact content with correct content-type', async () => {
    mockGetEvidence.mockResolvedValueOnce({
      id: '0',
      test_run_id: 'r',
      test_run_step_id: null,
      evidence_type: 'screenshot',
      artifact_id: 'a1',
      metadata: {},
      created_at: new Date(),
    });
    mockGetArtifact.mockResolvedValueOnce({
      id: 'a1',
      storage_key: 'ab/xxx.png',
      content_type: 'image/png',
      byte_size: '4',
      sha256: 'a'.repeat(64),
      created_at: new Date(),
    });
    mockRead.mockResolvedValueOnce(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const app = createApp();
    const res = await request(app).get('/api/evidence/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.body).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(mockRead).toHaveBeenCalledWith('ab/xxx.png');
  });
});
