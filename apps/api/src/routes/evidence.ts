import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { LocalArtifactStore } from '../artifacts/localArtifactStore.js';
import { env } from '../config/env.js';
import { getArtifactById, getEvidenceById } from '../db/repositories/evidenceRepo.js';
import { requireUser } from '../middleware/authenticate.js';

export const evidenceRouter = Router();

const artifactStore = new LocalArtifactStore(env.ARTIFACT_STORAGE_PATH);
const UuidParam = z.string().uuid();

evidenceRouter.get(
  '/evidence/:id',
  requireUser,
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = UuidParam.safeParse(req.params.id);
    if (!parsed.success) return next(new HttpError(400, 'Invalid evidence id'));
    try {
      const evidence = await getEvidenceById(pool, parsed.data);
      if (!evidence) return next(new HttpError(404, 'Evidence not found'));

      // Ownership check via test_run.owner_id. Non-admins get 404 (not 403)
      // when they don't own the evidence — to avoid leaking existence.
      const isAdmin = req.user?.role === 'admin';
      if (!isAdmin) {
        const ownerRes = await pool.query<{ owner_id: string | null }>(
          'SELECT owner_id FROM test_runs WHERE id = $1',
          [evidence.test_run_id],
        );
        const ownerId = ownerRes.rows[0]?.owner_id ?? null;
        if (ownerId !== req.user?.id) {
          return next(new HttpError(404, 'Evidence not found'));
        }
      }

      if (!evidence.artifact_id) {
        return next(new HttpError(404, 'Evidence has no binary artifact'));
      }
      const artifact = await getArtifactById(pool, evidence.artifact_id);
      if (!artifact) return next(new HttpError(404, 'Artifact not found'));

      let content: Buffer;
      try {
        content = await artifactStore.read(artifact.storage_key);
      } catch (err) {
        return next(
          new HttpError(
            500,
            `Artifact read failed: ${err instanceof Error ? err.message : 'unknown'}`,
          ),
        );
      }

      res.setHeader('Content-Type', artifact.content_type);
      res.setHeader('Content-Length', String(content.byteLength));
      res.setHeader('X-Artifact-SHA256', artifact.sha256);
      res.status(200).send(content);
    } catch (err) {
      next(err);
    }
  },
);
