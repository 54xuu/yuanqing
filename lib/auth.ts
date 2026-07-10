import { verifySession, SESSION_COOKIE } from './session';
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

/** Returns the current user from the session cookie, or null. */
export async function getCurrentUser(request: Request): Promise<User | null> {
  const token = getCookie(request, SESSION_COOKIE);
  const userId = await verifySession(token);
  if (!userId) return null;
  return getUserById(userId);
}

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; response: Response };

function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

function forbidden(): Response {
  return Response.json({ error: 'forbidden' }, { status: 403 });
}

/** Require an authenticated user. Returns 401 response if not logged in. */
export async function requireUser(request: Request): Promise<AuthResult> {
  const user = await getCurrentUser(request);
  if (!user) return { ok: false, response: unauthorized() };
  return { ok: true, user };
}

/** Require an admin user. Returns 401 if not logged in, 403 if not admin. */
export async function requireAdmin(request: Request): Promise<AuthResult> {
  const user = await getCurrentUser(request);
  if (!user) return { ok: false, response: unauthorized() };
  if (user.role !== 'admin') return { ok: false, response: forbidden() };
  return { ok: true, user };
}

/** Strip sensitive fields before sending a user to the client. */
export function toPublicUser(user: User): Omit<User, 'password_hash'> {
  const { password_hash: _password_hash, ...rest } = user;
  return rest;
}
