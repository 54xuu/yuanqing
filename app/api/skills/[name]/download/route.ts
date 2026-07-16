import JSZip from 'jszip';
import { requireUser } from '@/lib/auth';
import { getSkillWithFiles } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ name: string }> };

/** Download skill package as a ZIP archive. */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { name } = await params;
  const skill = getSkillWithFiles(auth.user.id, decodeURIComponent(name));
  if (!skill) {
    return Response.json({ error: 'skill not found' }, { status: 404 });
  }

  const zip = new JSZip();
  for (const file of skill.files) {
    if (file.encoding === 'base64') {
      zip.file(file.path, Buffer.from(file.content, 'base64'));
    } else {
      zip.file(file.path, file.content);
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const filename = `${skill.name}-v${skill.version}.zip`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${filename}"`,
      'content-length': String(buffer.length),
    },
  });
}
