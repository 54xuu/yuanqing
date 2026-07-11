import { serverError, badRequest } from '@/lib/apiError';
import { getApiKeyById, updateApiKey, deleteApiKey } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const key = getApiKeyById(id);
    if (!key) {
      return Response.json({ error: 'API密钥不存在' }, { status: 404 });
    }
    if (key.user_id !== auth.user.id && auth.user.role !== 'admin') {
      return Response.json({ error: '权限不足' }, { status: 403 });
    }

    let body: { name?: string };
    try {
      body = await request.json();
    } catch (err) {
      return badRequest('请求体格式无效', err);
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const updated = updateApiKey(id, name);
    if (!updated) {
      return Response.json({ error: 'API密钥不存在' }, { status: 404 });
    }
    return Response.json({ apiKey: updated }, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const key = getApiKeyById(id);
    if (!key) {
      return Response.json({ error: 'API密钥不存在' }, { status: 404 });
    }

    if (key.user_id !== auth.user.id && auth.user.role !== 'admin') {
      return Response.json({ error: '权限不足' }, { status: 403 });
    }

    deleteApiKey(id);
    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}
