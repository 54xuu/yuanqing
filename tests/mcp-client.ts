#!/usr/bin/env tsx
/**
 * End-to-end MCP client test.
 *
 * Spawns the real `mcp-server/index.ts` over stdio, then drives every
 * registered tool through the MCP protocol (initialize -> listTools ->
 * callTool) and asserts each tool behaves correctly.
 *
 * Run with:  npx tsx tests/mcp-client.ts
 *
 * The script uses a throwaway SQLite file (YUANQING_DB_PATH) so it never
 * touches the project's real `yuanqing.db`.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Run this script from the project root (e.g. `npx tsx tests/mcp-client.ts`).
const PROJECT_ROOT = process.cwd();

type Step = { name: string; ok: boolean; detail: string };
const results: Step[] = [];

function assert(name: string, cond: boolean, detail: string): void {
  results.push({ name, ok: cond, detail });
  const tag = cond ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${name}: ${detail}`);
}

// The MCP SDK's callTool() returns a union with index signatures, which makes
// direct property access resolve to `unknown`. For a test script we treat the
// result as `any` and pull out the first text content block.
function textOf(result: any): string {
  const item = result?.content?.[0];
  return item && item.type === 'text' && typeof item.text === 'string' ? item.text : '';
}

function jsonOf(result: any): any {
  const text = textOf(result);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'yuanqing-mcp-client-'));
  const dbPath = join(tmpDir, 'client-test.db');

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'mcp-server/index.ts'],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      YUANQING_DB_PATH: dbPath,
    } as Record<string, string>,
    stderr: 'inherit',
  });

  const client = new Client({ name: 'yuanqing-mcp-client', version: '0.1.0' });
  client.onerror = (err) => console.error('client error:', err);

  let exitCode = 0;

  try {
    await client.connect(transport);
    console.log('\nConnected to MCP server.');

    // 1) List tools
    console.log('\n=== Step 1: list tools ===');
    const toolsResp = await client.listTools();
    const toolNames = toolsResp.tools.map((t) => t.name).sort();
    console.log('  tools:', toolNames.join(', '));
    assert(
      'listTools returns 3 tools',
      toolNames.length === 3 &&
        ['get_note', 'search_notes', 'upsert_note'].every((n) => toolNames.includes(n)),
      `got [${toolNames.join(', ')}]`
    );

    // 2) search_notes
    console.log('\n=== Step 2: search_notes ===');
    const searchResp = await client.callTool({
      name: 'search_notes',
      arguments: { query: '源清' },
    });
    const searchData = jsonOf(searchResp);
    const searchOk =
      !!searchData &&
      typeof searchData.count === 'number' &&
      Array.isArray(searchData.results) &&
      searchData.count > 0;
    assert('search_notes finds seeded content', searchOk, `count=${searchData?.count}`);
    const firstSearchHit = searchData?.results?.[0];

    // 3) get_note (valid id from search results)
    console.log('\n=== Step 3: get_note (valid id) ===');
    const validNoteId: string | null = firstSearchHit?.id ?? null;
    if (validNoteId) {
      const getResp = await client.callTool({
        name: 'get_note',
        arguments: { id: validNoteId },
      });
      const getData = jsonOf(getResp);
      const getOk =
        !!getData &&
        'note' in getData &&
        getData.note.id === validNoteId &&
        typeof getData.note.content === 'string';
      assert('get_note returns full note', getOk, `title="${getData?.note?.title}"`);
    } else {
      assert('get_note returns full note', false, 'no search hit to look up');
    }

    // 4) get_note (invalid id -> isError)
    console.log('\n=== Step 4: get_note (invalid id) ===');
    const badId = 'definitely-not-a-real-id';
    const badResp = await client.callTool({
      name: 'get_note',
      arguments: { id: badId },
    });
    const badData = jsonOf(badResp);
    assert(
      'get_note flags invalid id',
      badResp.isError === true && badData?.error === 'note not found',
      `isError=${badResp.isError}`
    );

    // 5) upsert_note -> create
    console.log('\n=== Step 5: upsert_note (create) ===');
    const createTitle = `ClientTest ${Date.now()}`;
    const createContent = '# 客户端测试\n这是用 MCP 客户端写入的内容。';
    const createResp = await client.callTool({
      name: 'upsert_note',
      arguments: { path: createTitle, content: createContent },
    });
    const createData = jsonOf(createResp);
    const createOk =
      !!createData &&
      createData.action === 'created' &&
      createData.note?.title === createTitle &&
      createData.note?.content === createContent &&
      createData.note?.folder_id === null;
    assert('upsert_note creates a root note', createOk, `id=${createData?.note?.id}`);

    // 6) upsert_note -> update (same title -> same id, new content)
    console.log('\n=== Step 6: upsert_note (update) ===');
    const updatedContent = '# 客户端测试（已更新）\n内容已被覆盖。';
    const updateResp = await client.callTool({
      name: 'upsert_note',
      arguments: { path: createTitle, content: updatedContent },
    });
    const updateData = jsonOf(updateResp);
    const updateOk =
      !!updateData &&
      updateData.action === 'updated' &&
      updateData.note?.id === createData?.note?.id &&
      updateData.note?.content === updatedContent;
    assert(
      'upsert_note updates existing note',
      updateOk,
      `action=${updateData?.action}, sameId=${updateData?.note?.id === createData?.note?.id}`
    );

    // 7) upsert_note -> nested path creates folder hierarchy
    console.log('\n=== Step 7: upsert_note (nested path) ===');
    const folderName = `ClientFolder ${Date.now()}`;
    const nestedTitle = `Nested ${Date.now()}`;
    const nestedResp = await client.callTool({
      name: 'upsert_note',
      arguments: { path: `${folderName}/${nestedTitle}`, content: 'nested content' },
    });
    const nestedData = jsonOf(nestedResp);
    const nestedOk =
      !!nestedData &&
      nestedData.action === 'created' &&
      nestedData.note?.title === nestedTitle &&
      typeof nestedData.note?.folder_id === 'string';
    assert('upsert_note creates nested note under new folder', nestedOk, `folder_id=${nestedData?.note?.folder_id}`);

    // 8) search_notes picks up the newly created note
    console.log('\n=== Step 8: search_notes reflects new note ===');
    const reSearchResp = await client.callTool({
      name: 'search_notes',
      arguments: { query: createTitle },
    });
    const reSearchData = jsonOf(reSearchResp);
    const reSearchOk =
      !!reSearchData &&
      reSearchData.count >= 1 &&
      reSearchData.results.some((r: any) => r.id === createData?.note?.id);
    assert('search_notes finds the created note', reSearchOk, `count=${reSearchData?.count}`);

    // 9) get_note reflects the updated content
    console.log('\n=== Step 9: get_note reflects updated content ===');
    if (createData?.note?.id) {
      const finalResp = await client.callTool({
        name: 'get_note',
        arguments: { id: createData.note.id },
      });
      const finalData = jsonOf(finalResp);
      assert(
        'get_note returns updated content',
        !!finalData && finalData.note?.content === updatedContent,
        `contentLen=${finalData?.note?.content?.length ?? 0}`
      );
    } else {
      assert('get_note returns updated content', false, 'no created note id');
    }

    // 10) upsert_note -> empty path -> isError
    console.log('\n=== Step 10: upsert_note (empty path) ===');
    const emptyResp = await client.callTool({
      name: 'upsert_note',
      arguments: { path: '   ', content: 'x' },
    });
    const emptyData = jsonOf(emptyResp);
    assert(
      'upsert_note flags empty path',
      emptyResp.isError === true && !!emptyData?.error,
      `isError=${emptyResp.isError}`
    );
  } catch (err) {
    exitCode = 1;
    console.error('\nFATAL: client run threw:', err);
  } finally {
    // Close the client first so the child process can exit cleanly.
    try {
      await client.close();
    } catch {
      /* ignore */
    }

    // Best-effort cleanup of the temp DB directory.
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(`  [${r.ok ? 'PASS' : 'FAIL'}] ${r.name}: ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed > 0) exitCode = 1;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
