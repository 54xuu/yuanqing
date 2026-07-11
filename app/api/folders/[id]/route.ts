import { serverError, badRequest } from '@/lib/apiError';
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
    return serverError(err);
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
    } catch (err) {
      return badRequest('请求体格式无效', err);
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
    return serverError(err);
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
    return serverError(err);
  }
}
