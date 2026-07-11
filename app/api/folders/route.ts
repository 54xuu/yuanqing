import { listFolders, createFolder, type Folder } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const folders: Folder[] = listFolders();
    return Response.json({ folders }, { status: 200 });
  } catch (err) {
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: { name?: unknown; parent_id?: string | null };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: '请求体格式无效' }, { status: 400 });
    }

    const name = typeof body?.name === 'string' ? body.name : '';
    if (!name) {
      return Response.json({ error: '名称为必填项' }, { status: 400 });
    }

    const parent_id =
      body.parent_id === undefined || body.parent_id === null ? null : body.parent_id;

    const folder = createFolder(name, parent_id ?? null);
    return Response.json(folder, { status: 201 });
  } catch (err) {
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
