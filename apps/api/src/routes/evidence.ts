import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { LocalArtifactStore } from '../artifacts/localArtifactStore.js';
import { env } from '../config/env.js';
import { getArtifactById, getEvidenceById } from '../db/repositories/evidenceRepo.js';

export const evidenceRouter = Router();

const artifactStore = new LocalArtifactStore(env.ARTIFACT_STORAGE_PATH);
const UuidParam = z.string().uuid();

evidenceRouter.get(
  '/evidence/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = UuidParam.safeParse(req.params.id);
    if (!parsed.success) return next(new HttpError(400, 'Invalid evidence id'));
    try {
      const evidence = await getEvidenceById(pool, parsed.data);
      if (!evidence) return next(new HttpError(404, 'Evidence not found'));
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
