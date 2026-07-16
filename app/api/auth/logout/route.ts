import { requireUser } from '@/lib/auth';
import { bumpSessionVersion } from '@/lib/db';
import { clearSessionCookieHeader } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  bumpSessionVersion(auth.user.id);

  const cookie = clearSessionCookieHeader();
  return Response.json({ ok: true }, { status: 200, headers: { 'set-cookie': cookie } });
}
