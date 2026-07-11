import { listUsers, createUser, getUserByUsername } from '@/lib/db';
import { requireAdmin, toPublicUser } from '@/lib/auth';
import type { UserRole } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const users = listUsers().map(toPublicUser);
  return Response.json({ users }, { status: 200 });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    let body: { username?: unknown; password?: unknown; role?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: '请求体格式无效' }, { status: 400 });
    }

    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) {
      return Response.json({ error: '用户名和密码为必填项' }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: '密码至少需要8个字符' }, { status: 400 });
    }

    const role: UserRole =
      body?.role === 'admin' ? 'admin' : 'user';

    if (getUserByUsername(username)) {
      return Response.json({ error: '用户名已存在' }, { status: 409 });
    }

    const user = createUser(username, password, role);
    return Response.json({ user: toPublicUser(user) }, { status: 201 });
  } catch {
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
