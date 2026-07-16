import { requireUser } from '@/lib/auth';
import { listSkills } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const skills = listSkills(auth.user.id);
  return Response.json({ skills, count: skills.length });
}
