import { requireUser } from '@/lib/auth';
import { getUserById, updateUserPassword } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { serverError, badRequest } from '@/lib/apiError';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    let body: { current_password?: unknown; new_password?: unknown };
    try {
      body = await request.json();
    } catch (err) {
      return badRequest('请求体格式无效', err);
    }

    const current = typeof body.current_password === 'string' ? body.current_password : '';
    const next = typeof body.new_password === 'string' ? body.new_password : '';
    if (!current || !next) {
      return Response.json({ error: '当前密码和新密码为必填项' }, { status: 400 });
    }
    if (next.length < 8) {
      return Response.json({ error: '新密码至少 8 位' }, { status: 400 });
    }

    const user = getUserById(auth.user.id);
    if (!user || !verifyPassword(current, user.password_hash)) {
      return Response.json({ error: '当前密码错误' }, { status: 401 });
    }

    updateUserPassword(auth.user.id, next);
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
