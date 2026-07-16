/**
 * Edge-safe session helpers using WebCrypto (globalThis.crypto.subtle).
 *
 * This module MUST stay free of any Node-only imports (no `node:crypto`,
 * no better-sqlite3) because it is imported by `middleware.ts`, which runs
 * on the Edge runtime. Both Edge and Node runtimes provide `globalThis.crypto`.
 */

export const SESSION_COOKIE = 'yq_session';

/** Default session lifetime: 7 days (seconds). */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type SessionPayload = {
  uid: string;
  iat: number;
  exp: number;
  sv: number;
};

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

function encodePayload(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const bin = fromBase64Url(encoded);
    const json = new TextDecoder().decode(bin);
    const parsed = JSON.parse(json) as SessionPayload;
    if (
      typeof parsed.uid !== 'string' ||
      typeof parsed.iat !== 'number' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.sv !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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

/** Sign a session payload into `base64url(payload).signature`. */
export async function signSession(
  userId: string,
  sessionVersion: number,
  maxAgeSec: number = SESSION_MAX_AGE_SEC
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: userId,
    iat: now,
    exp: now + maxAgeSec,
    sv: sessionVersion,
  };
  const payloadStr = encodePayload(payload);
  const key = await importHmacKey();
  const enc = new TextEncoder();
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(payloadStr));
  return `${payloadStr}.${toBase64Url(new Uint8Array(sig))}`;
}

/**
 * Verify a session token signature and expiry.
 * Returns the payload if valid and not expired; otherwise null.
 * Does NOT check session_version against DB (Node layer does that).
 */
export async function verifySession(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const sep = token.indexOf('.');
  if (sep === -1) return null;
  const payloadStr = token.slice(0, sep);
  const sigStr = token.slice(sep + 1);
  if (!payloadStr || !sigStr) return null;
  try {
    const key = await importHmacKey();
    const enc = new TextEncoder();
    const ok = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sigStr),
      enc.encode(payloadStr)
    );
    if (!ok) return null;
    const payload = decodePayload(payloadStr);
    if (!payload) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    return payload;
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
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

/** Build Set-Cookie header value that clears the session cookie. */
export function clearSessionCookieHeader(): string {
  const opts = sessionCookieOptions();
  return `${SESSION_COOKIE}=; Path=${opts.path}; HttpOnly; SameSite=${opts.sameSite}; Max-Age=0${opts.secure ? '; Secure' : ''}`;
}
