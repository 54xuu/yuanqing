import { getUserByUsername } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { signSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session';
import { toPublicUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    let body: { username?: unknown; password?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid JSON body' }, { status: 400 });
    }

    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) {
      return Response.json({ error: 'username and password are required' }, { status: 400 });
    }

    const user = getUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return Response.json({ error: 'invalid credentials' }, { status: 401 });
    }

    const token = await signSession(user.id);
    const opts = sessionCookieOptions();
    const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=${opts.path}; HttpOnly; SameSite=${opts.sameSite}; Max-Age=${opts.maxAge}${opts.secure ? '; Secure' : ''}`;

    return Response.json(
      { user: toPublicUser(user) },
      { status: 200, headers: { 'set-cookie': cookie } }
    );
  } catch {
    return Response.json({ error: 'internal server error' }, { status: 500 });
  }
}
