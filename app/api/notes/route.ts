import {
  listNotes,
  createNote,
  searchNotes,
  type Note,
  type NoteSummary,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const folder_id = searchParams.get('folder_id');

    if (q !== null) {
      const results: NoteSummary[] = searchNotes(q);
      return Response.json({ results }, { status: 200 });
    }

    if (folder_id !== null) {
      const notes: Note[] =
        folder_id === 'null' ? listNotes(null) : listNotes(folder_id);
      return Response.json({ notes }, { status: 200 });
    }

    const notes: Note[] = listNotes();
    return Response.json({ notes }, { status: 200 });
  } catch (err) {
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: { folder_id?: string | null; title?: unknown; content?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: '请求体格式无效' }, { status: 400 });
    }

    const title = typeof body?.title === 'string' ? body.title : '';
    if (!title) {
      return Response.json({ error: '标题为必填项' }, { status: 400 });
    }

    const folder_id =
      body.folder_id === undefined || body.folder_id === null ? null : body.folder_id;
    const content = typeof body?.content === 'string' ? body.content : '';

    const note = createNote({ folder_id, title, content });
    return Response.json({ note }, { status: 201 });
  } catch (err) {
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
