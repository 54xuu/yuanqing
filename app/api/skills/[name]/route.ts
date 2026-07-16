import { requireUser } from '@/lib/auth';
import { getSkillWithFiles, deleteSkill } from '@/lib/db';
import { serverError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ name: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { name } = await params;
  const skill = getSkillWithFiles(auth.user.id, decodeURIComponent(name));
  if (!skill) {
    return Response.json({ error: 'skill not found' }, { status: 404 });
  }
  return Response.json({ skill });
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const { name } = await params;
    const result = deleteSkill(auth.user.id, decodeURIComponent(name));
    if ('error' in result) {
      return Response.json({ error: result.error }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    return serverError(err);
  }
}
