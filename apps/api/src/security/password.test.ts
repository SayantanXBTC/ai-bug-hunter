import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength } from './password.js';

describe('password', () => {
  it('hash+verify roundtrip', async () => {
    const h = await hashPassword('correcthorse1');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correcthorse1', h)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const h = await hashPassword('correcthorse1');
    expect(await verifyPassword('wrongpassword2', h)).toBe(false);
  });

  it('rejects malformed hash', async () => {
    expect(await verifyPassword('anything1', 'not-a-hash')).toBe(false);
  });

  it('validates complexity', () => {
    expect(validatePasswordStrength('short1').ok).toBe(false);
    expect(validatePasswordStrength('nodigitsatall').ok).toBe(false);
    expect(validatePasswordStrength('1234567890').ok).toBe(false);
    expect(validatePasswordStrength('goodpassword1').ok).toBe(true);
  });
});
