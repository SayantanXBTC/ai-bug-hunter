import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scryptAsync(pw: string, salt: Buffer, keylen: number, params: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pw, salt, keylen, { N: params.N, r: params.r, p: params.p, maxmem: 128 * params.N * params.r * 2 }, (err, key) => {
      if (err) return reject(err);
      resolve(key as Buffer);
    });
  });
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pw, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4]!, 'hex');
  const expected = Buffer.from(parts[5]!, 'hex');
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || salt.length === 0 || expected.length === 0) {
    return false;
  }
  let actual: Buffer;
  try {
    actual = await scryptAsync(pw, salt, expected.length, { N: n, r, p });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export type PasswordStrengthResult = { ok: true } | { ok: false; reason: string };

export function validatePasswordStrength(pw: string): PasswordStrengthResult {
  if (typeof pw !== 'string') return { ok: false, reason: 'password must be a string' };
  if (pw.length < 10) return { ok: false, reason: 'password must be at least 10 characters' };
  if (pw.length > 256) return { ok: false, reason: 'password must be at most 256 characters' };
  if (!/[A-Za-z]/.test(pw)) return { ok: false, reason: 'password must contain a letter' };
  if (!/\d/.test(pw)) return { ok: false, reason: 'password must contain a digit' };
  return { ok: true };
}
