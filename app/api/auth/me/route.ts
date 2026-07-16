import { checkSession, toPublicUser } from '@/lib/auth';
import { clearSessionCookieHeader } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await checkSession(request);
  if (session.status !== 'ok') {
    const clearCookie = session.status === 'invalid' && session.clearCookie;
    const headers: HeadersInit = {};
    if (clearCookie) {
      headers['set-cookie'] = clearSessionCookieHeader();
    }
    return Response.json({ error: '未登录或登录已过期' }, { status: 401, headers });
  }
  return Response.json({ user: toPublicUser(session.user) }, { status: 200 });
}
