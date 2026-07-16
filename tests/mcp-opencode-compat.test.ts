import { describe, it, expect } from 'vitest';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '../mcp-server/index';

const MCP_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

async function postMcp(body: unknown, extraHeaders: Record<string, string> = {}): Promise<unknown> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer();
  await server.connect(transport);

  const request = new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { ...MCP_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  });
  const response = await transport.handleRequest(request);
  const raw = await response.text();
  const line = raw.split('\n').find((l) => l.startsWith('data: '));
  if (!line) return null;
  return JSON.parse(line.slice(6));
}

describe('createMcpServer OpenCode compatibility', () => {
  it('returns empty lists for optional prompts/list and resources/list', async () => {
    const initData = (await postMcp({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'opencode-test', version: '1.0.0' },
      },
    })) as { result?: { protocolVersion?: string } };
    expect(initData?.result?.protocolVersion).toBe('2025-03-26');

    const protocolHeader = { 'mcp-protocol-version': '2025-03-26' };

    const promptsData = (await postMcp(
      { jsonrpc: '2.0', id: 2, method: 'prompts/list', params: {} },
      protocolHeader
    )) as { result?: { prompts?: unknown[] }; error?: { code: number } };
    expect(promptsData?.error).toBeUndefined();
    expect(promptsData?.result?.prompts).toEqual([]);

    const resourcesData = (await postMcp(
      { jsonrpc: '2.0', id: 3, method: 'resources/list', params: {} },
      protocolHeader
    )) as { result?: { resources?: unknown[] }; error?: { code: number } };
    expect(resourcesData?.error).toBeUndefined();
    expect(resourcesData?.result?.resources).toEqual([]);

    const templatesData = (await postMcp(
      { jsonrpc: '2.0', id: 4, method: 'resources/templates/list', params: {} },
      protocolHeader
    )) as { result?: { resourceTemplates?: unknown[] }; error?: { code: number } };
    expect(templatesData?.error).toBeUndefined();
    expect(templatesData?.result?.resourceTemplates).toEqual([]);
  });
});
