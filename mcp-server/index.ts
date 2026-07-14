#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  searchNotes,
  getNote,
  getFolderByParentAndName,
  getNoteByFolderAndTitle,
  createFolder,
  createNote,
  updateNote,
  getNoteByPath,
  upsertMemory,
  recallMemory,
  getUserByUsername,
  listSkills,
  getSkillWithFiles,
  upsertSkill,
  deleteSkill,
  listMcpConfigs,
  getMcpConfig,
  upsertMcpConfig,
  deleteMcpConfig,
  type Note,
  type NoteSummary,
  type MemScope,
  type UpsertMemoryResult,
  type RecallMemoryResult,
  type SkillSummary,
  type SkillWithFiles,
  type McpConfig,
  type McpConfigSummary,
  type SkillFileEncoding,
} from '../lib/db';

export type McpServerContext = {
  /** Owning yuanqing user id; required for skill/mcp catalog tools. */
  userId?: string;
};

// ---------- Tool handler logic (testable, raw JS objects) ----------

export type SearchNotesResult = { count: number; results: NoteSummary[] };

export type GetNoteResult = { note: Note } | { error: string; id: string };

export type UpsertNoteResult =
  | { action: 'created'; note: Note }
  | { action: 'updated'; note: Note }
  | { error: string; path: string };

export async function handleSearchNotes({
  query,
}: {
  query: string;
}): Promise<SearchNotesResult> {
  const results = searchNotes(query);
  return { count: results.length, results };
}

export async function handleGetNote({
  id,
}: {
  id: string;
}): Promise<GetNoteResult> {
  const note = getNote(id);
  if (!note) return { error: 'note not found', id };
  return { note };
}

/**
 * Create or update a note by slash-separated path.
 *
 * The last path segment is the note title; any preceding segments name a
 * nested folder hierarchy (created on demand). If a note with the same title
 * already exists in the target folder, its content is replaced; otherwise a
 * new note is created.
 *
 * Examples:
 *   path = "笔记B"            -> note "笔记B" at the root (folder_id = null)
 *   path = "目录A/笔记B"       -> note "笔记B" under folder "目录A"
 *   path = "A/B/笔记B"        -> note "笔记B" under folder "A/B"
 */
export async function handleUpsertNote({
  path,
  content,
}: {
  path: string;
  content: string;
}): Promise<UpsertNoteResult> {
  const normalized = path.trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return { error: 'path must not be empty', path };
  }
  const segments = normalized.split(/\/+/).filter((s) => s.length > 0);
  const title = segments.pop();
  if (!title) {
    return { error: 'path must include a note title', path };
  }

  // Walk / create the folder hierarchy (all segments except the last one).
  let parentId: string | null = null;
  for (const seg of segments) {
    let folder = getFolderByParentAndName(parentId, seg);
    if (!folder) {
      folder = createFolder(seg, parentId);
    }
    parentId = folder.id;
  }

  // Find or create the note by title within the resolved folder.
  const existing = getNoteByFolderAndTitle(parentId, title);
  if (existing) {
    const note = updateNote(existing.id, { content });
    if (!note) {
      return { error: 'failed to update note', path };
    }
    return { action: 'updated', note };
  }
  const note = createNote({ folder_id: parentId, title, content });
  return { action: 'created', note };
}

export type GetNoteByPathResult = { note: Note } | { error: string; path: string };

/**
 * Look up a note by its slash-separated path. The last segment is the note
 * title; preceding segments name a nested folder hierarchy. Returns the note
 * or { error: 'note not found', path } if no note exists at that path.
 */
export async function handleGetNoteByPath({
  path,
}: {
  path: string;
}): Promise<GetNoteByPathResult> {
  const note = getNoteByPath(path);
  if (!note) return { error: 'note not found', path };
  return { note };
}

export type SaveMemoryResult = UpsertMemoryResult;

/**
 * Persist a memory note with scope metadata so other agents can recall it.
 * Scope guide:
 * - global: preferences unrelated to any tool/project (language, coding style)
 * - tool: quirks of a specific agent app (cursor / trae)
 * - project: conventions unique to one repository
 */
export async function handleSaveMemory(input: {
  scope: MemScope;
  tool?: string;
  project?: string;
  title: string;
  content: string;
  source_app?: string;
  tags?: string[];
}): Promise<SaveMemoryResult> {
  return upsertMemory(input);
}

/**
 * Recall the memory pack for the current client context:
 * global ∪ tool-scoped ∪ project-scoped. Call at session start / task switch.
 */
export async function handleRecallMemory(input: {
  tool?: string;
  project?: string;
  query?: string;
}): Promise<RecallMemoryResult> {
  return recallMemory(input);
}

// ---------- Skill / MCP catalog handlers (require userId) ----------

function requireUserId(
  userId: string | undefined
): { userId: string } | { error: string } {
  if (!userId) {
    return {
      error:
        'user context missing: skill/mcp catalog tools require an authenticated API key (HTTP) or admin fallback (stdio)',
    };
  }
  return { userId };
}

export type ListSkillsResult =
  | { count: number; skills: SkillSummary[] }
  | { error: string };

export async function handleListSkills(
  userId: string | undefined
): Promise<ListSkillsResult> {
  const ctx = requireUserId(userId);
  if ('error' in ctx) return ctx;
  const skills = listSkills(ctx.userId);
  return { count: skills.length, skills };
}

export type DownloadSkillResult =
  | { skill: SkillWithFiles }
  | { error: string; name?: string };

export async function handleDownloadSkill(
  userId: string | undefined,
  name: string
): Promise<DownloadSkillResult> {
  const ctx = requireUserId(userId);
  if ('error' in ctx) return ctx;
  const skill = getSkillWithFiles(ctx.userId, name);
  if (!skill) return { error: 'skill not found', name };
  return { skill };
}

export type UploadSkillResult =
  | { action: 'created' | 'updated'; skill: SkillWithFiles }
  | { error: string };

export async function handleUploadSkill(
  userId: string | undefined,
  input: {
    name: string;
    description?: string;
    files: { path: string; content: string; encoding?: SkillFileEncoding }[];
  }
): Promise<UploadSkillResult> {
  const ctx = requireUserId(userId);
  if ('error' in ctx) return ctx;
  return upsertSkill(ctx.userId, input);
}

export type DeleteSkillToolResult =
  | { action: 'deleted'; name: string }
  | { error: string };

export async function handleDeleteSkill(
  userId: string | undefined,
  name: string
): Promise<DeleteSkillToolResult> {
  const ctx = requireUserId(userId);
  if ('error' in ctx) return ctx;
  return deleteSkill(ctx.userId, name);
}

export type ListMcpResult =
  | { count: number; mcps: McpConfigSummary[] }
  | { error: string };

export async function handleListMcp(
  userId: string | undefined
): Promise<ListMcpResult> {
  const ctx = requireUserId(userId);
  if ('error' in ctx) return ctx;
  const mcps = listMcpConfigs(ctx.userId);
  return { count: mcps.length, mcps };
}

export type DownloadMcpResult =
  | { mcp: McpConfig; config: Record<string, unknown> }
  | { error: string; name?: string };

export async function handleDownloadMcp(
  userId: string | undefined,
  name: string
): Promise<DownloadMcpResult> {
  const ctx = requireUserId(userId);
  if ('error' in ctx) return ctx;
  const mcp = getMcpConfig(ctx.userId, name);
  if (!mcp) return { error: 'mcp config not found', name };
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(mcp.config) as Record<string, unknown>;
  } catch {
    config = {};
  }
  return { mcp, config };
}

export type UploadMcpResult =
  | { action: 'created' | 'updated'; mcp: McpConfig }
  | { error: string };

export async function handleUploadMcp(
  userId: string | undefined,
  input: {
    name: string;
    description?: string;
    config: unknown;
  }
): Promise<UploadMcpResult> {
  const ctx = requireUserId(userId);
  if ('error' in ctx) return ctx;
  return upsertMcpConfig(ctx.userId, input);
}

export type DeleteMcpToolResult =
  | { action: 'deleted'; name: string }
  | { error: string };

export async function handleDeleteMcp(
  userId: string | undefined,
  name: string
): Promise<DeleteMcpToolResult> {
  const ctx = requireUserId(userId);
  if ('error' in ctx) return ctx;
  return deleteMcpConfig(ctx.userId, name);
}

function jsonResult(data: unknown, isError = false) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

// ---------- MCP tool registrations (wrap handlers in MCP envelope) ----------

function registerTools(server: McpServer, ctx: McpServerContext): void {
  // Tool: search_notes
  server.tool(
    'search_notes',
    'Search personal notes by keyword. Returns matching notes with id, title, and a content summary.',
    { query: z.string().describe('Search keyword(s)') },
    async ({ query }) => {
      const data = await handleSearchNotes({ query });
      return jsonResult(data);
    }
  );

  // Tool: get_note
  server.tool(
    'get_note',
    'Get the full content of a note by its id.',
    { id: z.string().describe('Note id (uuid)') },
    async ({ id }) => {
      const data = await handleGetNote({ id });
      return jsonResult(data, 'error' in data);
    }
  );

  // Tool: upsert_note
  server.tool(
    'upsert_note',
    'Create or update a note by slash-separated path. The last segment is the note title; preceding segments name a nested folder hierarchy (created on demand). If a note with the same title already exists in the target folder, its content is replaced; otherwise a new note is created. Returns { action: "created" | "updated", note }.',
    {
      path: z
        .string()
        .describe(
          'Note path, e.g. "目录A/笔记B" creates/updates note "笔记B" under folder "目录A". Use just "笔记B" for a root-level note.'
        ),
      content: z.string().describe('New full Markdown content for the note.'),
    },
    async ({ path, content }) => {
      const data = await handleUpsertNote({ path, content });
      return jsonResult(data, 'error' in data);
    }
  );

  // Tool: get_note_by_path
  server.tool(
    'get_note_by_path',
    'Get the full content of a note by its slash-separated path. Use the exact path used to create the note via upsert_note (e.g. "目录A/子目录B/笔记D"). Returns the full note object, or { error: "note not found", path } if no note exists at that path.',
    {
      path: z
        .string()
        .describe(
          'Slash-separated note path, e.g. "目录A/笔记B" or "根级笔记".'
        ),
    },
    async ({ path }) => {
      const data = await handleGetNoteByPath({ path });
      return jsonResult(data, 'error' in data);
    }
  );

  // Tool: recall_memory
  server.tool(
    'recall_memory',
    'Recall shared cross-app memories for the current context. Returns a pack grouped as { global, tool, project, count }. Call at session start or when switching tasks. Pass tool (e.g. "cursor"/"trae") and project (repo name) so the server returns global ∪ matching tool memories ∪ matching project memories. Optional query further filters by keyword.',
    {
      tool: z
        .string()
        .optional()
        .describe('Current agent app name, e.g. "cursor" or "trae".'),
      project: z
        .string()
        .optional()
        .describe('Current repository / project name, e.g. "yuanqing".'),
      query: z
        .string()
        .optional()
        .describe('Optional keyword filter applied within the scoped memories.'),
    },
    async ({ tool, project, query }) => {
      const data = await handleRecallMemory({ tool, project, query });
      return jsonResult(data);
    }
  );

  // Tool: save_memory
  server.tool(
    'save_memory',
    'Persist a memory to the shared cloud knowledge base so other agents (Cursor/Trae/etc.) can recall it. Scope guide: use "global" for preferences unrelated to any tool/project (output language, coding norms); use "tool" for quirks of a specific agent app (requires tool=cursor|trae); use "project" for conventions unique to one repository (requires project=<repo>). Same title under the same scope upserts (overwrites) the existing memory.',
    {
      scope: z
        .enum(['global', 'tool', 'project'])
        .describe('Memory layer: global | tool | project.'),
      tool: z
        .string()
        .optional()
        .describe('Required when scope="tool". e.g. "cursor" or "trae".'),
      project: z
        .string()
        .optional()
        .describe('Required when scope="project". e.g. "yuanqing".'),
      title: z.string().describe('Short memory title (also used as the note title).'),
      content: z.string().describe('Full Markdown content of the memory.'),
      source_app: z
        .string()
        .optional()
        .describe('Which app is writing this memory, e.g. "cursor" or "trae".'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Optional list of tags for later filtering.'),
    },
    async ({ scope, tool, project, title, content, source_app, tags }) => {
      const data = await handleSaveMemory({
        scope,
        tool,
        project,
        title,
        content,
        source_app,
        tags,
      });
      return jsonResult(data, 'error' in data);
    }
  );

  // ---- Skill catalog ----

  server.tool(
    'list_skills',
    'List skills in the current yuanqing account catalog (scoped by API key user). Returns { count, skills: [{ name, description, version, updated_at, file_count }] }.',
    {},
    async () => {
      const data = await handleListSkills(ctx.userId);
      return jsonResult(data, 'error' in data);
    }
  );

  server.tool(
    'download_skill',
    'Download a skill package (multi-file) from the current yuanqing account. Returns { skill: { name, description, version, files: [{ path, content, encoding }] } }. Write files under the target tool skill directory (see yuanqing-download-skill).',
    {
      name: z
        .string()
        .describe('Skill name, e.g. "yuanqing-recall-memory" (kebab-case).'),
    },
    async ({ name }) => {
      const data = await handleDownloadSkill(ctx.userId, name);
      return jsonResult(data, 'error' in data);
    }
  );

  server.tool(
    'upload_skill',
    'Upload or overwrite a skill package for the current yuanqing account. Pass all files relative to the skill root (e.g. SKILL.md, scripts/foo.sh). encoding defaults to utf8; use base64 for binary. Same name upserts and increments version. Secret headers are not applicable here.',
    {
      name: z.string().describe('Skill name matching [a-z0-9-].'),
      description: z
        .string()
        .optional()
        .describe('Short description (usually from SKILL.md frontmatter).'),
      files: z
        .array(
          z.object({
            path: z
              .string()
              .describe('Relative path inside the skill, e.g. "SKILL.md".'),
            content: z.string().describe('File content (utf8 text or base64).'),
            encoding: z
              .enum(['utf8', 'base64'])
              .optional()
              .describe('Content encoding; default utf8.'),
          })
        )
        .describe('All files in the skill directory.'),
    },
    async ({ name, description, files }) => {
      const data = await handleUploadSkill(ctx.userId, {
        name,
        description,
        files,
      });
      return jsonResult(data, 'error' in data);
    }
  );

  server.tool(
    'delete_skill',
    'Soft-delete a skill from the current yuanqing account catalog.',
    {
      name: z.string().describe('Skill name to delete.'),
    },
    async ({ name }) => {
      const data = await handleDeleteSkill(ctx.userId, name);
      return jsonResult(data, 'error' in data);
    }
  );

  // ---- MCP config catalog ----

  server.tool(
    'list_mcp',
    'List MCP server configs stored in the current yuanqing account catalog. Returns { count, mcps: [{ name, description, updated_at }] }.',
    {},
    async () => {
      const data = await handleListMcp(ctx.userId);
      return jsonResult(data, 'error' in data);
    }
  );

  server.tool(
    'download_mcp',
    'Download one MCP server config. Returns { mcp, config } where config is the JSON fragment to merge into mcpServers[name]. Sensitive headers are stored as ${YUANQING_API_KEY} placeholders — replace with the local key when writing.',
    {
      name: z.string().describe('MCP server name, e.g. "yuanqing".'),
    },
    async ({ name }) => {
      const data = await handleDownloadMcp(ctx.userId, name);
      return jsonResult(data, 'error' in data);
    }
  );

  server.tool(
    'upload_mcp',
    'Upload or overwrite an MCP server config for the current yuanqing account. config is the JSON object for one server (url/command/headers/env). Values in headers matching api-key/authorization/token/secret are replaced with ${YUANQING_API_KEY} before storage.',
    {
      name: z.string().describe('MCP server name matching [a-z0-9-].'),
      description: z.string().optional().describe('Short description.'),
      config: z
        .union([z.record(z.string(), z.unknown()), z.string()])
        .describe(
          'MCP server JSON object, or a JSON string. Example: { "url": "https://host/api/mcp", "headers": { "x-api-key": "..." } }.'
        ),
    },
    async ({ name, description, config }) => {
      const data = await handleUploadMcp(ctx.userId, {
        name,
        description,
        config,
      });
      return jsonResult(data, 'error' in data);
    }
  );

  server.tool(
    'delete_mcp',
    'Soft-delete an MCP config from the current yuanqing account catalog.',
    {
      name: z.string().describe('MCP server name to delete.'),
    },
    async ({ name }) => {
      const data = await handleDeleteMcp(ctx.userId, name);
      return jsonResult(data, 'error' in data);
    }
  );
}

/**
 * Resolve userId for stdio local mode: use explicit ctx.userId, else admin.
 */
export function resolveMcpUserId(ctx?: McpServerContext): string | undefined {
  if (ctx?.userId) return ctx.userId;
  const admin = getUserByUsername('admin');
  return admin?.id;
}

/**
 * Build a fresh, configured McpServer instance with tools registered.
 * Used by both the stdio entry and the HTTP (`/api/mcp`) transport.
 * Pass `{ userId }` from the authenticated API key so catalog tools are scoped.
 */
export function createMcpServer(ctx?: McpServerContext): McpServer {
  const server = new McpServer({
    name: 'yuanqing',
    version: '0.1.0',
  });
  const userId = resolveMcpUserId(ctx);
  registerTools(server, { userId });
  return server;
}

// ---------- Start the server with stdio transport ----------

// Only auto-connect when run as the real entry point (e.g. `npm run mcp`).
// Vitest sets process.env.VITEST='true' automatically, so importing this
// module from tests will NOT try to grab stdin/stdout.
if (!process.env.VITEST) {
  (async () => {
    const transport = new StdioServerTransport();
    await createMcpServer().connect(transport);
  })();
}
