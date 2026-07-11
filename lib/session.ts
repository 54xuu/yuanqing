/**
 * Edge-safe session helpers using WebCrypto (globalThis.crypto.subtle).
 *
 * This module MUST stay free of any Node-only imports (no `node:crypto`,
 * no better-sqlite3) because it is imported by `middleware.ts`, which runs
 * on the Edge runtime. Both Edge and Node runtimes provide `globalThis.crypto`.
 */

export const SESSION_COOKIE = 'yq_session';

// Stable dev-only fallback secret. The Edge middleware and Node route handlers
// run in separate runtime contexts (even in `next dev`), so a per-process random
// secret would be generated independently in each context and cookies signed by
// a route handler could never be verified by middleware. A stable string is
// shared across all runtimes. Production MUST set YUANQING_SESSION_SECRET.
const DEV_FALLBACK_SECRET = 'yuanqing-dev-session-secret-change-in-production';

function getSecret(): string {
  const env = process.env.YUANQING_SESSION_SECRET;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'YUANQING_SESSION_SECRET must be set (>= 16 chars) in production.'
    );
  }
  return DEV_FALLBACK_SECRET;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): ArrayBuffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function importHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Sign a userId into a `userId.signature` session token. */
export async function signSession(userId: string): Promise<string> {
  const key = await importHmacKey();
  const enc = new TextEncoder();
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(userId));
  return `${userId}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Verify a session token. Returns the userId if valid, otherwise null. */
export async function verifySession(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const sep = token.indexOf('.');
  if (sep === -1) return null;
  const userId = token.slice(0, sep);
  const sigStr = token.slice(sep + 1);
  if (!userId || !sigStr) return null;
  try {
    const key = await importHmacKey();
    const enc = new TextEncoder();
    const ok = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sigStr),
      enc.encode(userId)
    );
    return ok ? userId : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: 'lax';
  path: string;
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure:
      process.env.NODE_ENV === 'production' &&
      process.env.YUANQING_COOKIE_SECURE !== 'false',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
