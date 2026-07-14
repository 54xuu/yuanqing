#!/usr/bin/env tsx
/**
 * End-to-end: upload a local skill to yuanqing, then download into .trae/skills/.
 *
 * Usage:
 *   YUANQING_BASE_URL=http://192.168.3.249:3000 \
 *   YUANQING_API_KEY=yq_... \
 *   npx tsx tests/verify-skill-trae-sync.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE = process.env.YUANQING_BASE_URL || 'http://192.168.3.249:3000';
const API_KEY = process.env.YUANQING_API_KEY;
const SKILL_NAME = process.env.SKILL_NAME || 'yuanqing-download-skill';
const SOURCE_DIR = join(process.cwd(), 'skills', SKILL_NAME);
const TARGET_ROOT = join(process.cwd(), '.trae', 'skills', SKILL_NAME);

function collectFiles(dir: string, root = dir): { path: string; content: string; encoding: 'utf8' | 'base64' }[] {
  const out: { path: string; content: string; encoding: 'utf8' | 'base64' }[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectFiles(full, root));
    } else {
      const rel = relative(root, full).replace(/\\/g, '/');
      const buf = readFileSync(full);
      const isText = /\.(md|txt|json|sh|ts|js|yaml|yml)$/i.test(rel);
      if (isText) {
        out.push({ path: rel, content: buf.toString('utf8'), encoding: 'utf8' });
      } else {
        out.push({ path: rel, content: buf.toString('base64'), encoding: 'base64' });
      }
    }
  }
  return out;
}

function textOf(result: unknown): string {
  const r = result as { content?: { type?: string; text?: string }[] };
  const item = r?.content?.[0];
  return item?.type === 'text' && typeof item.text === 'string' ? item.text : '';
}

function jsonOf(result: unknown): Record<string, unknown> {
  try {
    return JSON.parse(textOf(result)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function main() {
  if (!API_KEY) {
    console.error('YUANQING_API_KEY is required');
    process.exit(1);
  }

  const files = collectFiles(SOURCE_DIR);
  if (files.length === 0) {
    console.error(`No files in ${SOURCE_DIR}`);
    process.exit(1);
  }

  const url = new URL('/api/mcp', BASE);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { 'x-api-key': API_KEY } },
  });
  const client = new Client({ name: 'verify-skill-trae-sync', version: '0.1.0' });
  await client.connect(transport);

  try {
    console.log(`[1/3] upload_skill → ${BASE} name=${SKILL_NAME} files=${files.length}`);
    const up = jsonOf(
      await client.callTool({
        name: 'upload_skill',
        arguments: {
          name: SKILL_NAME,
          description: 'Trae sync verification skill',
          files,
        },
      })
    );
    if (!('action' in up)) {
      console.error('upload failed:', up);
      process.exit(1);
    }
    console.log('  upload:', up.action, 'version=', (up.skill as { version?: number })?.version);

    console.log(`[2/3] download_skill name=${SKILL_NAME}`);
    const dl = jsonOf(
      await client.callTool({
        name: 'download_skill',
        arguments: { name: SKILL_NAME },
      })
    );
    const skill = dl.skill as {
      name: string;
      files: { path: string; content: string; encoding: string }[];
    } | undefined;
    if (!skill?.files?.length) {
      console.error('download failed:', dl);
      process.exit(1);
    }

    console.log(`[3/3] write → ${TARGET_ROOT}`);
    for (const f of skill.files) {
      const dest = join(TARGET_ROOT, f.path);
      mkdirSync(join(dest, '..'), { recursive: true });
      const data =
        f.encoding === 'base64'
          ? Buffer.from(f.content, 'base64')
          : Buffer.from(f.content, 'utf8');
      writeFileSync(dest, data);
      console.log('  wrote', relative(process.cwd(), dest));
    }

    console.log('\nOK: upload + download to .trae verified');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
