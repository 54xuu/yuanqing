import { requireUser } from '@/lib/auth';
import { badRequest, serverError } from '@/lib/apiError';
import {
  linkMemoryAliases,
  listKnownMemoryNames,
  listMemoryAliasGroups,
  unlinkMemoryAlias,
  type MemoryAliasScope,
} from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAliasScope(value: unknown): value is MemoryAliasScope {
  return value === 'project' || value === 'tool';
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const groups = listMemoryAliasGroups();
    const { projectNames, toolNames } = listKnownMemoryNames();
    return Response.json({ groups, projectNames, toolNames });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    let body: { scope?: unknown; names?: unknown };
    try {
      body = await request.json();
    } catch (err) {
      return badRequest('请求体格式无效', err);
    }

    if (!isAliasScope(body.scope)) {
      return Response.json(
        { error: 'scope 必须是 project 或 tool' },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.names) || !body.names.every((n) => typeof n === 'string')) {
      return Response.json(
        { error: 'names 必须是字符串数组' },
        { status: 400 }
      );
    }

    const result = linkMemoryAliases(body.scope, body.names);
    if ('error' in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json(result, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    const name = url.searchParams.get('name');
    if (!isAliasScope(scope)) {
      return Response.json(
        { error: 'scope 必须是 project 或 tool' },
        { status: 400 }
      );
    }
    if (!name || !name.trim()) {
      return Response.json({ error: 'name 为必填项' }, { status: 400 });
    }

    const result = unlinkMemoryAlias(scope, name);
    if ('error' in result) {
      return Response.json({ error: result.error }, { status: 404 });
    }
    return Response.json(result, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}
