import { getCurrentUser, toPublicUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return Response.json({ error: '未登录或登录已过期' }, { status: 401 });
  }
  return Response.json({ user: toPublicUser(user) }, { status: 200 });
}
