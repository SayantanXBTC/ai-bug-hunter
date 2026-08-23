import type { Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { env } from '../config/env.js';
import { generateOpaqueToken, hashToken } from './tokens.js';
import * as sessionRepo from '../db/repositories/sessionRepo.js';
import { findUserById, type UserRow } from '../db/repositories/userRepo.js';
import { clearCookie, readCookie, setCookie } from './cookies.js';

export const SESSION_COOKIE = 'abh_session';

type Executor = Pool | PoolClient;

export interface CreatedSession {
  token: string;
  expiresAt: Date;
  sessionId: string;
}

export async function createSession(exec: Executor, userId: string, req: Request): Promise<CreatedSession> {
  const { token, hash } = generateOpaqueToken();
  const ttlMs = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);
  const userAgent = req.headers['user-agent'] ?? null;
  const ip = extractIp(req);
  const row = await sessionRepo.insertSession(exec, {
    userId,
    tokenHash: hash,
    expiresAt,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : null,
    ip,
  });
  return { token, expiresAt, sessionId: row.id };
}

export async function verifySession(exec: Executor, rawToken: string): Promise<UserRow | null> {
  if (!rawToken) return null;
  const hash = hashToken(rawToken);
  const row = await sessionRepo.findByTokenHash(exec, hash);
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at.getTime() <= Date.now()) return null;
  return await findUserById(exec, row.user_id);
}

export async function revokeSession(exec: Executor, rawToken: string): Promise<void> {
  if (!rawToken) return;
  await sessionRepo.revokeByTokenHash(exec, hashToken(rawToken));
}

export function setSessionCookie(res: Response, token: string): void {
  const maxAgeSeconds = env.SESSION_TTL_DAYS * 24 * 60 * 60;
  setCookie(res, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAgeSeconds,
  });
}

export function clearSessionCookie(res: Response): void {
  clearCookie(res, SESSION_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
  });
}

export function readSessionCookie(req: Request): string | undefined {
  return readCookie(req, SESSION_COOKIE);
}

function extractIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? null;
}
