import { listApiKeysByUser, createApiKey, getUserById } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const keys = listApiKeysByUser(id);
  return Response.json({ keys }, { status: 200 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!getUserById(id)) {
    return Response.json({ error: 'user not found' }, { status: 404 });
  }

  let name = '';
  try {
    const body = await request.json();
    if (typeof body?.name === 'string') name = body.name.trim();
  } catch {
    // name is optional; ignore parse errors
  }

  const apiKey = createApiKey(id, name);
  return Response.json({ apiKey }, { status: 201 });
}
