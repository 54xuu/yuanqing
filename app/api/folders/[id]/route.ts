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
      return Response.json({ error: 'folder not found' }, { status: 404 });
    }
    return Response.json({ folder }, { status: 200 });
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
    let body: { name?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid JSON body' }, { status: 400 });
    }

    const name = typeof body?.name === 'string' ? body.name : '';
    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    const folder = updateFolder(id, name);
    if (!folder) {
      return Response.json({ error: 'folder not found' }, { status: 404 });
    }
    return Response.json({ folder }, { status: 200 });
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
    const ok = deleteFolder(id);
    if (!ok) {
      return Response.json({ error: 'folder not found' }, { status: 404 });
    }
    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    return Response.json({ error: 'internal server error' }, { status: 500 });
  }
}
