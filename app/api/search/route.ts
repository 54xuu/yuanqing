import { searchNotes, type NoteSummary } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    if (!q) {
      return Response.json({ results: [] }, { status: 200 });
    }
    const results: NoteSummary[] = searchNotes(q);
    return Response.json({ results }, { status: 200 });
  } catch (err) {
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
