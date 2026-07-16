import { requireUser } from '@/lib/auth';
import { listNotes, getEffectiveMemoryScope } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const notes = listNotes();
  const memories = notes
    .map((note) => {
      const effective = getEffectiveMemoryScope(note);
      return { note, effective };
    })
    .filter(({ effective }) => effective.scope != null)
    .map(({ note, effective }) => ({
      id: note.id,
      title: note.title,
      mem_scope: effective.scope,
      mem_tool: effective.tool,
      mem_project: effective.project,
      updated_at: note.updated_at,
      folder_id: note.folder_id,
    }));

  return Response.json({ memories, count: memories.length });
}
