import { listApiKeysByUser, createApiKey } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const keys = listApiKeysByUser(auth.user.id);
  return Response.json({ keys }, { status: 200 });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  let name = '';
  try {
    const body = await request.json();
    if (typeof body?.name === 'string') name = body.name.trim();
  } catch {
    // name is optional; ignore parse errors
  }

  const apiKey = createApiKey(auth.user.id, name);
  return Response.json({ apiKey }, { status: 201 });
}
