import { getApiKeyById, deleteApiKey } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const key = getApiKeyById(id);
  if (!key) {
    return Response.json({ error: 'api key not found' }, { status: 404 });
  }

  // Only the owner or an admin may delete.
  if (key.user_id !== auth.user.id && auth.user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  deleteApiKey(id);
  return Response.json({ ok: true }, { status: 200 });
}
