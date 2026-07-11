import { serverError, badRequest } from '@/lib/apiError';
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
      return Response.json({ error: '笔记不存在' }, { status: 404 });
    }
    return Response.json({ note }, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: {
      title?: string;
      content?: string;
      folder_id?: string | null;
      sort_order?: number;
    };
    try {
      body = await request.json();
    } catch (err) {
      return badRequest('请求体格式无效', err);
    }

    const note = updateNote(id, {
      title: typeof body.title === 'string' ? body.title : undefined,
      content: typeof body.content === 'string' ? body.content : undefined,
      folder_id:
        body.folder_id === undefined ? undefined : (body.folder_id ?? null),
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : undefined,
    });
    if (!note) {
      return Response.json({ error: '笔记不存在' }, { status: 404 });
    }
    return Response.json({ note }, { status: 200 });
  } catch (err) {
    return serverError(err);
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
      return Response.json({ error: '笔记不存在' }, { status: 404 });
    }
    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}
