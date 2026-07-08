import { getNote, updateNote, deleteNote } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = getNote(id);
    if (!note) {
      return Response.json({ error: 'note not found' }, { status: 404 });
    }
    return Response.json({ note }, { status: 200 });
  } catch (err) {
    return Response.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: { title?: string; content?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid JSON body' }, { status: 400 });
    }

    const note = updateNote(id, {
      title: typeof body?.title === 'string' ? body.title : undefined,
      content: typeof body?.content === 'string' ? body.content : undefined,
    });
    if (!note) {
      return Response.json({ error: 'note not found' }, { status: 404 });
    }
    return Response.json({ note }, { status: 200 });
  } catch (err) {
    return Response.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = deleteNote(id);
    if (!ok) {
      return Response.json({ error: 'note not found' }, { status: 404 });
    }
    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    return Response.json({ error: 'internal server error' }, { status: 500 });
  }
}
