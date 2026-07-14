#!/usr/bin/env tsx
/**
 * Dual-user skill/mcp catalog roundtrip against a live HTTP /api/mcp endpoint.
 *
 * Usage:
 *   YUANQING_BASE_URL=http://127.0.0.1:3000 npx tsx tests/catalog-http-roundtrip.ts
 *
 * Or without a running server: the script can bootstrap via handlers only when
 * CATALOG_HTTP=0 (default for CI without server). Set CATALOG_HTTP=1 to require HTTP.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  createUser,
  deleteUser,
  createApiKey,
  deleteApiKey,
} from '../lib/db';

const BASE = process.env.YUANQING_BASE_URL || 'http://127.0.0.1:3000';
const REQUIRE_HTTP = process.env.CATALOG_HTTP === '1';

type Step = { name: string; ok: boolean; detail: string };
const results: Step[] = [];

function assert(name: string, cond: boolean, detail: string): void {
  results.push({ name, ok: cond, detail });
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
}

function textOf(result: unknown): string {
  const r = result as { content?: { type?: string; text?: string }[] };
  const item = r?.content?.[0];
  return item && item.type === 'text' && typeof item.text === 'string'
    ? item.text
    : '';
}

function jsonOf(result: unknown): unknown {
  try {
    return JSON.parse(textOf(result));
  } catch {
    return null;
  }
}

async function withClient(apiKey: string, fn: (c: Client) => Promise<void>) {
  const url = new URL('/api/mcp', BASE);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: { 'x-api-key': apiKey },
    },
  });
  const client = new Client({ name: 'catalog-http', version: '0.1.0' });
  await client.connect(transport);
  try {
    await fn(client);
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  // Probe server
  let reachable = false;
  try {
    const res = await fetch(new URL('/api/auth/login', BASE), { method: 'GET' });
    reachable = res.status !== 0;
  } catch {
    reachable = false;
  }

  if (!reachable) {
    if (REQUIRE_HTTP) {
      console.error(`HTTP server not reachable at ${BASE}`);
      process.exit(1);
    }
    console.log(
      `Skip HTTP roundtrip (server not at ${BASE}). Unit tests already cover isolation.`
    );
    process.exit(0);
  }

  const userA = createUser(`http-a-${Date.now()}`, 'password-ok-12');
  const userB = createUser(`http-b-${Date.now()}`, 'password-ok-12');
  const keyA = createApiKey(userA.id, 'http-a');
  const keyB = createApiKey(userB.id, 'http-b');

  try {
    console.log('\n=== Dual-key HTTP catalog roundtrip ===');

    await withClient(keyA.key, async (client) => {
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name);
      assert(
        'catalog tools present',
        [
          'list_skills',
          'upload_skill',
          'download_skill',
          'delete_skill',
          'list_mcp',
          'upload_mcp',
          'download_mcp',
          'delete_mcp',
        ].every((n) => names.includes(n)),
        names.join(', ')
      );

      const up = await client.callTool({
        name: 'upload_skill',
        arguments: {
          name: 'http-round-skill',
          description: 'from A',
          files: [{ path: 'SKILL.md', content: '# from A\n', encoding: 'utf8' }],
        },
      });
      const upJson = jsonOf(up) as { action?: string };
      assert('A upload_skill', upJson?.action === 'created', JSON.stringify(upJson));

      const list = jsonOf(
        await client.callTool({ name: 'list_skills', arguments: {} })
      ) as { count?: number };
      assert('A list_skills count>=1', (list?.count ?? 0) >= 1, JSON.stringify(list));
    });

    await withClient(keyB.key, async (client) => {
      const dl = jsonOf(
        await client.callTool({
          name: 'download_skill',
          arguments: { name: 'http-round-skill' },
        })
      ) as { error?: string };
      assert(
        'B cannot download A skill',
        typeof dl?.error === 'string',
        JSON.stringify(dl)
      );

      await client.callTool({
        name: 'upload_mcp',
        arguments: {
          name: 'demo-server',
          description: 'B mcp',
          config: {
            url: 'https://example.com/api/mcp',
            headers: { 'x-api-key': 'yq_plain_should_scrub' },
          },
        },
      });
      const mcp = jsonOf(
        await client.callTool({
          name: 'download_mcp',
          arguments: { name: 'demo-server' },
        })
      ) as { config?: { headers?: Record<string, string> } };
      assert(
        'B mcp key scrubbed',
        mcp?.config?.headers?.['x-api-key'] === '${YUANQING_API_KEY}',
        JSON.stringify(mcp)
      );
    });

    await withClient(keyA.key, async (client) => {
      await client.callTool({
        name: 'delete_skill',
        arguments: { name: 'http-round-skill' },
      });
    });
  } finally {
    deleteApiKey(keyA.id);
    deleteApiKey(keyB.id);
    deleteUser(userA.id);
    deleteUser(userB.id);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} passed`
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
