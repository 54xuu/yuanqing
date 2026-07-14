import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/mcp-server/index';
import { getApiKeyByKey } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractApiKey(request: Request): string | null {
  const header = request.headers.get('x-api-key');
  if (header) return header.trim();
  const auth = request.headers.get('authorization');
  if (auth && /^bearer\s+/i.test(auth)) {
    return auth.replace(/^bearer\s+/i, '').trim();
  }
  return null;
}

function unauthorized(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32001, message: '未授权：API密钥缺失或无效' },
      id: null,
    }),
    { status: 401, headers: { 'content-type': 'application/json' } }
  );
}

async function handleMcp(request: Request): Promise<Response> {
  const apiKey = extractApiKey(request);
  if (!apiKey) return unauthorized();
  const record = getApiKeyByKey(apiKey);
  if (!record) return unauthorized();

  // Stateless mode: a fresh transport + server per request (the SDK forbids
  // reusing a stateless transport across requests).
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer({ userId: record.user_id });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: Request) {
  return handleMcp(request);
}

export async function GET(request: Request) {
  return handleMcp(request);
}

export async function DELETE(request: Request) {
  return handleMcp(request);
}
