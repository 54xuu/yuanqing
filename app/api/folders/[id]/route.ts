import { getFolder, updateFolder, deleteFolder } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const folder = getFolder(id);
    if (!folder) {
      return Response.json({ error: '文件夹不存在' }, { status: 404 });
    }
    return Response.json({ folder }, { status: 200 });
  } catch (err) {
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: { name?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: '请求体格式无效' }, { status: 400 });
    }

    const name = typeof body?.name === 'string' ? body.name : '';
    if (!name) {
      return Response.json({ error: '名称为必填项' }, { status: 400 });
    }

    const folder = updateFolder(id, name);
    if (!folder) {
      return Response.json({ error: '文件夹不存在' }, { status: 404 });
    }
    return Response.json({ folder }, { status: 200 });
  } catch (err) {
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = deleteFolder(id);
    if (!ok) {
      return Response.json({ error: '文件夹不存在' }, { status: 404 });
    }
    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
