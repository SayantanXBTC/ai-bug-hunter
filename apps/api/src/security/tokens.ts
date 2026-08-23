import { createHash, randomBytes } from 'node:crypto';

export interface OpaqueToken {
  token: string;
  hash: string;
}

export function generateOpaqueToken(byteLen = 32): OpaqueToken {
  const raw = randomBytes(byteLen);
  const token = raw.toString('base64url');
  const hash = hashToken(token);
  return { token, hash };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
