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
    let body: { name?: string; parent_id?: string | null; sort_order?: number };
    try {
      body = await request.json();
    } catch (err) {
      return badRequest('请求体格式无效', err);
    }

    const folder = updateFolder(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      parent_id:
        body.parent_id === undefined ? undefined : (body.parent_id ?? null),
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : undefined,
    });
    if (!folder) {
      return Response.json({ error: '文件夹不存在' }, { status: 404 });
    }
    return Response.json({ folder }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === 'cycle') {
      return Response.json(
        { error: '不能将文件夹移动到其子级下' },
        { status: 400 }
      );
    }
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
