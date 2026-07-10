import { SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const cookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=lax; Max-Age=0`;
  return Response.json({ ok: true }, { status: 200, headers: { 'set-cookie': cookie } });
}
