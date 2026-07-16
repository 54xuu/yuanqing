import { verifySession, SESSION_COOKIE, clearSessionCookieHeader } from './session';
import { getUserById, type User } from './db';

/**
 * Node-only auth helpers for Route Handlers (use better-sqlite3).
 * `middleware.ts` MUST NOT import this module (it uses the DB).
 */

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

export type SessionCheck =
  | { status: 'ok'; user: User }
  | { status: 'missing' }
  | { status: 'invalid'; clearCookie: boolean };

/** Resolve session cookie → user; detect stale tokens that must be cleared. */
export async function checkSession(request: Request): Promise<SessionCheck> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return { status: 'missing' };
  const payload = await verifySession(token);
  if (!payload) return { status: 'invalid', clearCookie: true };
  const user = getUserById(payload.uid);
  if (!user) return { status: 'invalid', clearCookie: true };
  const sv = user.session_version ?? 0;
  if (payload.sv !== sv) return { status: 'invalid', clearCookie: true };
  return { status: 'ok', user };
}

/** Returns the current user from the session cookie, or null. */
export async function getCurrentUser(request: Request): Promise<User | null> {
  const session = await checkSession(request);
  return session.status === 'ok' ? session.user : null;
}

function unauthorizedResponse(clearCookie = false): Response {
  const headers: HeadersInit = {};
  if (clearCookie) headers['set-cookie'] = clearSessionCookieHeader();
  return Response.json({ error: '未登录或登录已过期' }, { status: 401, headers });
}

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; response: Response };

function forbidden(): Response {
  return Response.json({ error: '权限不足' }, { status: 403 });
}

/** Require an authenticated user. Returns 401 response if not logged in. */
export async function requireUser(request: Request): Promise<AuthResult> {
  const session = await checkSession(request);
  if (session.status === 'ok') return { ok: true, user: session.user };
  return {
    ok: false,
    response: unauthorizedResponse(session.status === 'invalid' && session.clearCookie),
  };
}

/** Require an admin user. Returns 401 if not logged in, 403 if not admin. */
export async function requireAdmin(request: Request): Promise<AuthResult> {
  const session = await checkSession(request);
  if (session.status !== 'ok') {
    return {
      ok: false,
      response: unauthorizedResponse(session.status === 'invalid' && session.clearCookie),
    };
  }
  if (session.user.role !== 'admin') return { ok: false, response: forbidden() };
  return { ok: true, user: session.user };
}

/** Strip sensitive fields before sending a user to the client. */
export function toPublicUser(user: User): Omit<User, 'password_hash'> {
  const { password_hash: _password_hash, ...rest } = user;
  return rest;
}
