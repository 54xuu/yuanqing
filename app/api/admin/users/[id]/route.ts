import { deleteUser } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Prevent an admin from deleting themselves.
  if (id === auth.user.id) {
    return Response.json({ error: '不能删除当前登录用户' }, { status: 400 });
  }

  const ok = deleteUser(id);
  if (!ok) {
    return Response.json({ error: '用户不存在' }, { status: 404 });
  }
  return Response.json({ ok: true }, { status: 200 });
}
