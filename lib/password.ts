import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 64;
const N = 16384;
const R = 8;
const P = 1;

/**
 * Hash a plaintext password using scrypt.
 * Returns `saltHex:hashHex` for deterministic storage.
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEY_LEN, { N, r: R, p: P });
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored `saltHex:hashHex` string.
 * Uses a constant-time comparison.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  const sep = stored.indexOf(':');
  if (sep === -1) return false;
  const saltHex = stored.slice(0, sep);
  const hashHex = stored.slice(sep + 1);
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== KEY_LEN) return false;
  const hash = scryptSync(plain, salt, KEY_LEN, { N, r: R, p: P });
  return timingSafeEqual(hash, expected);
}
