import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from './password';
import { randomBytes } from 'node:crypto';

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  sort_order: number;
}

export type MemScope = 'global' | 'tool' | 'project';

export interface Note {
  id: string;
  folder_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
  /** Memory scope: 'global' | 'tool' | 'project' | null (plain note). */
  mem_scope: MemScope | null;
  /** Tool name when mem_scope='tool' (e.g. 'cursor' | 'trae'). */
  mem_tool: string | null;
  /** Project name when mem_scope='project'. */
  mem_project: string | null;
  /** Which app wrote this memory (e.g. 'cursor' | 'trae'). */
  source_app: string | null;
  /** JSON array of tags, or null. */
  mem_tags: string | null;
}

export interface NoteSummary {
  id: string;
  title: string;
  summary: string;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key: string;
  name: string;
  created_at: string;
}

export interface ApiKeyWithUsername extends ApiKey {
  username: string;
}

type DB = Database.Database;

const DB_PATH = process.env.YUANQING_DB_PATH || './yuanqing.db';

let dbInstance: DB | null = null;

function ensureColumn(db: DB, table: string, column: string, definition: string): void {
  const cols = db.prepare('PRAGMA table_info(' + table + ')').all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + definition);
  }
}

function initSchema(db: DB): void {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS Folder (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES Folder(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS Note (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES Folder(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_note_folder ON Note(folder_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS Note_fts USING fts5(
      note_id UNINDEXED,
      title,
      content,
      tokenize = 'unicode61'
    );

    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ApiKey (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_apikey_user ON ApiKey(user_id);
    CREATE INDEX IF NOT EXISTS idx_apikey_key ON ApiKey(key);
  `);

  ensureColumn(db, 'Folder', 'sort_order', 'sort_order INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'Note', 'sort_order', 'sort_order INTEGER NOT NULL DEFAULT 0');
  // Cross-app memory metadata (null = plain note, not part of memory recall).
  ensureColumn(db, 'Note', 'mem_scope', 'mem_scope TEXT');
  ensureColumn(db, 'Note', 'mem_tool', 'mem_tool TEXT');
  ensureColumn(db, 'Note', 'mem_project', 'mem_project TEXT');
  ensureColumn(db, 'Note', 'source_app', 'source_app TEXT');
  ensureColumn(db, 'Note', 'mem_tags', 'mem_tags TEXT');
}

const INTRO_NOTE_CONTENT = '# 自我介绍\n\n你好，我是张源（Zhang Yuan），一名专注于知识工具与开发者体验的软件工程师。\n\n## 简介\n- 目前主导源清（YuanQing）项目，专注于本地优先的知识管理工具与 AI Agent 集成\n- 5 年全栈开发经验，擅长 TypeScript、Node.js、React 与 SQLite\n- 热衷于把复杂的检索与上下文管理问题，转化为简洁可复用的工程方案\n\n## 技能栈\n- 前端：React 19、Next.js（App Router）、TailwindCSS\n- 后端：Node.js、Next.js API Routes、better-sqlite3\n- AI 集成：MCP（Model Context Protocol）、Prompt 工程、向量检索\n- 工程化：Vitest、GitHub Actions、Docker\n\n## 联系方式\n- Email：zhangyuan@example.com\n- GitHub：github.com/zhangyuan\n\n把这条笔记交给 AI，它就能在对话中准确还原我的身份与背景。\n';

const PRODUCT_NOTE_CONTENT = '# 产品介绍：源清（YuanQing）\n\n## 定位\n源清是一款本地优先（local-first）的私有知识库，沉淀你的个人上下文，并通过 MCP Server 让任意支持 MCP 的 AI Agent 自动检索读取。\n\n## 核心痛点\n1. **重复喂料**：每次和不同 AI 对话都要重新粘贴自我介绍、产品背景\n2. **信息孤岛**：笔记散落在多个应用，AI 无法统一访问\n3. **检索困难**：长文档里找不到关键句，人工翻阅效率低\n\n## 解决方案\n- 用 SQLite + FTS5 提供毫秒级全文检索\n- 用 Folder/Note 结构化组织个人上下文\n- 暴露 MCP 工具 search_notes(query) 与 get_note(id)，Agent 主动按需拉取\n\n## 目标用户\n- 频繁与多个 AI Agent 协作的开发者\n- 需要稳定可复用「人设/产品背景」的独立开发者与小团队\n- 重视数据私有、希望本地存储的从业者\n\n## MCP 集成\n源清自带一个 stdio 模式的 MCP Server，可在 Claude Desktop、Trae 等支持 MCP 的客户端中直接配置，无需额外认证。Agent 调用 search_notes 获取候选笔记摘要，再调用 get_note 读取完整 Markdown，即可在对话中引用你的知识。\n';

function seedIfEmpty(db: DB): void {
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM Note').get() as { cnt: number };
  if (row.cnt > 0) return;

  const now = new Date().toISOString();

  const folderId = uuidv4();
  db.prepare(
    'INSERT INTO Folder (id, name, parent_id, created_at, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(folderId, '源清', null, now, 0);

  const introId = uuidv4();
  db.prepare(
    'INSERT INTO Note (id, folder_id, title, content, created_at, updated_at, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(introId, folderId, '自我介绍', INTRO_NOTE_CONTENT, now, now, 0);
  db.prepare(
    'INSERT INTO Note_fts (note_id, title, content) VALUES (?, ?, ?)'
  ).run(introId, '自我介绍', INTRO_NOTE_CONTENT);

  const productId = uuidv4();
  db.prepare(
    'INSERT INTO Note (id, folder_id, title, content, created_at, updated_at, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(productId, folderId, '产品介绍', PRODUCT_NOTE_CONTENT, now, now, 1);
  db.prepare(
    'INSERT INTO Note_fts (note_id, title, content) VALUES (?, ?, ?)'
  ).run(productId, '产品介绍', PRODUCT_NOTE_CONTENT);
}

function seedAdmin(db: DB): void {
  const row = db
    .prepare("SELECT COUNT(*) AS cnt FROM User WHERE role = 'admin'")
    .get() as { cnt: number };
  if (row.cnt > 0) return;
  const id = uuidv4();
  const now = new Date().toISOString();
  const password = process.env.YUANQING_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    const generated = randomBytes(12).toString('base64url');
    console.warn('[security] No YUANQING_ADMIN_PASSWORD set (or < 8 chars).');
    console.warn('[security] Generated random admin password (save it now):');
    console.warn('[security]   username: admin');
    console.warn('[security]   password: ' + generated);
    db.prepare(
      'INSERT INTO User (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, 'admin', hashPassword(generated), 'admin', now);
    return;
  }
  db.prepare(
    'INSERT INTO User (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, 'admin', hashPassword(password), 'admin', now);
}

export function getDb(): DB {
  if (dbInstance) return dbInstance;
  const db = new Database(DB_PATH);
  initSchema(db);
  seedIfEmpty(db);
  seedAdmin(db);
  dbInstance = db;
  return db;
}

function getMaxFolderSortOrder(parent_id: string | null): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM Folder WHERE parent_id IS ?')
    .get(parent_id) as { m: number };
  return row.m;
}

function getMaxNoteSortOrder(folder_id: string | null): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM Note WHERE folder_id IS ?')
    .get(folder_id) as { m: number };
  return row.m;
}

function isDescendant(folderId: string, ancestorId: string): boolean {
  const db = getDb();
  let currentId: string | null = ancestorId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    if (currentId === folderId) return true;
    const row = db
      .prepare('SELECT parent_id FROM Folder WHERE id = ?')
      .get(currentId) as { parent_id: string | null } | undefined;
    if (!row) return false;
    currentId = row.parent_id;
  }
  return false;
}

export function listFolders(): Folder[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM Folder ORDER BY sort_order ASC, name ASC')
    .all() as Folder[];
}

export function createFolder(name: string, parent_id: string | null): Folder {
  const db = getDb();
  const id = uuidv4();
  const created_at = new Date().toISOString();
  const sort_order = getMaxFolderSortOrder(parent_id) + 1;
  db.prepare(
    'INSERT INTO Folder (id, name, parent_id, created_at, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, parent_id, created_at, sort_order);
  return { id, name, parent_id, created_at, sort_order };
}

export function getFolder(id: string): Folder | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM Folder WHERE id = ?').get(id) as Folder | undefined;
  return row ?? null;
}

export function getFolderByParentAndName(
  parent_id: string | null,
  name: string
): Folder | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM Folder WHERE parent_id IS ? AND name = ?')
    .get(parent_id, name) as Folder | undefined;
  return row ?? null;
}

export interface FolderUpdateInput {
  name?: string;
  parent_id?: string | null;
  sort_order?: number;
}

export function updateFolder(id: string, input: FolderUpdateInput): Folder | null {
  const db = getDb();
  const existing = getFolder(id);
  if (!existing) return null;

  const name = input.name ?? existing.name;
  const sort_order = input.sort_order ?? existing.sort_order;
  const parent_id = input.parent_id === undefined ? existing.parent_id : input.parent_id;

  if (parent_id !== null && parent_id === id) {
    throw new Error('cycle');
  }
  if (parent_id !== null && parent_id !== existing.parent_id) {
    if (isDescendant(id, parent_id)) {
      throw new Error('cycle');
    }
  }

  db.prepare(
    'UPDATE Folder SET name = ?, parent_id = ?, sort_order = ? WHERE id = ?'
  ).run(name, parent_id, sort_order, id);

  return getFolder(id);
}

export function deleteFolder(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM Folder WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listNotes(folder_id?: string | null): Note[] {
  const db = getDb();
  if (folder_id === undefined) {
    return db
      .prepare('SELECT * FROM Note ORDER BY sort_order ASC, updated_at DESC')
      .all() as Note[];
  }
  return db
    .prepare('SELECT * FROM Note WHERE folder_id IS ? ORDER BY sort_order ASC, updated_at DESC')
    .all(folder_id) as Note[];
}

export function createNote(input: {
  folder_id?: string | null;
  title: string;
  content?: string;
  sort_order?: number;
}): Note {
  const db = getDb();
  const id = uuidv4();
  const folder_id = input.folder_id ?? null;
  const title = input.title;
  const content = input.content ?? '';
  const now = new Date().toISOString();
  const sort_order = input.sort_order ?? getMaxNoteSortOrder(folder_id) + 1;

  db.prepare(
    'INSERT INTO Note (id, folder_id, title, content, created_at, updated_at, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, folder_id, title, content, now, now, sort_order);
  db.prepare('INSERT INTO Note_fts (note_id, title, content) VALUES (?, ?, ?)').run(
    id,
    title,
    content
  );

  return {
    id,
    folder_id,
    title,
    content,
    created_at: now,
    updated_at: now,
    sort_order,
    mem_scope: null,
    mem_tool: null,
    mem_project: null,
    source_app: null,
    mem_tags: null,
  };
}

export function getNote(id: string): Note | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM Note WHERE id = ?').get(id) as Note | undefined;
  return row ?? null;
}

export function getNoteByFolderAndTitle(
  folder_id: string | null,
  title: string
): Note | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM Note WHERE folder_id IS ? AND title = ?')
    .get(folder_id, title) as Note | undefined;
  return row ?? null;
}

export interface NoteUpdateInput {
  title?: string;
  content?: string;
  folder_id?: string | null;
  sort_order?: number;
}

export function updateNote(id: string, input: NoteUpdateInput): Note | null {
  const db = getDb();
  const existing = getNote(id);
  if (!existing) return null;

  const title = input.title ?? existing.title;
  const content = input.content ?? existing.content;
  const folder_id =
    input.folder_id === undefined ? existing.folder_id : input.folder_id;
  const sort_order = input.sort_order ?? existing.sort_order;
  const updated_at = new Date().toISOString();

  db.prepare(
    'UPDATE Note SET title = ?, content = ?, folder_id = ?, sort_order = ?, updated_at = ? WHERE id = ?'
  ).run(title, content, folder_id, sort_order, updated_at, id);

  db.prepare('DELETE FROM Note_fts WHERE note_id = ?').run(id);
  db.prepare('INSERT INTO Note_fts (note_id, title, content) VALUES (?, ?, ?)').run(
    id,
    title,
    content
  );

  return getNote(id);
}

export function deleteNote(id: string): boolean {
  const db = getDb();
  db.prepare('DELETE FROM Note_fts WHERE note_id = ?').run(id);
  const result = db.prepare('DELETE FROM Note WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getNoteByPath(path: string): Note | null {
  const normalized = path.trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) return null;
  const segments = normalized.split(/\/+/).filter((s) => s.length > 0);
  const title = segments.pop();
  if (!title) return null;

  let parentId: string | null = null;
  for (const seg of segments) {
    const folder = getFolderByParentAndName(parentId, seg);
    if (!folder) return null;
    parentId = folder.id;
  }
  return getNoteByFolderAndTitle(parentId, title);
}

export function toFtsQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((token) => '"' + token.replace(/"/g, '""') + '"')
    .join(' ');
}

export function searchNotes(query: string): NoteSummary[] {
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) return [];
  const db = getDb();
  return db
    .prepare(
      'SELECT note_id AS id, title, snippet(Note_fts, 2, ?, ?, ?, 24) AS summary FROM Note_fts WHERE Note_fts MATCH ? ORDER BY rank LIMIT 20'
    )
    .all('', '', '...', ftsQuery) as NoteSummary[];
}

// ---------- Cross-app memory (global / tool / project) ----------

export interface UpsertMemoryInput {
  scope: MemScope;
  tool?: string;
  project?: string;
  title: string;
  content: string;
  source_app?: string;
  tags?: string[];
}

export type UpsertMemoryResult =
  | { action: 'created'; note: Note }
  | { action: 'updated'; note: Note }
  | { error: string };

export interface RecallMemoryInput {
  tool?: string;
  project?: string;
  query?: string;
}

export interface RecallMemoryResult {
  global: Note[];
  tool: Note[];
  project: Note[];
  count: number;
}

function normalizeMemoryTitle(title: string): string {
  return title.trim();
}

function ensureFolderPath(segments: string[]): string | null {
  let parentId: string | null = null;
  for (const seg of segments) {
    let folder = getFolderByParentAndName(parentId, seg);
    if (!folder) {
      folder = createFolder(seg, parentId);
    }
    parentId = folder.id;
  }
  return parentId;
}

function memoryFolderSegments(
  scope: MemScope,
  tool?: string,
  project?: string
): { segments: string[]; error?: string } {
  if (scope === 'global') {
    return { segments: ['全局记忆'] };
  }
  if (scope === 'tool') {
    const t = (tool ?? '').trim();
    if (!t) return { segments: [], error: 'tool is required when scope is "tool"' };
    return { segments: ['工具记忆', t] };
  }
  const p = (project ?? '').trim();
  if (!p) return { segments: [], error: 'project is required when scope is "project"' };
  return { segments: ['项目记忆', p] };
}

function serializeTags(tags?: string[]): string | null {
  if (!tags || tags.length === 0) return null;
  return JSON.stringify(tags);
}

/**
 * Create or update a memory note under the convention folder tree:
 * - global  -> 全局记忆/<title>
 * - tool    -> 工具记忆/<tool>/<title>
 * - project -> 项目记忆/<project>/<title>
 */
export function upsertMemory(input: UpsertMemoryInput): UpsertMemoryResult {
  const title = normalizeMemoryTitle(input.title);
  if (!title) return { error: 'title must not be empty' };
  if (!input.content && input.content !== '') {
    return { error: 'content is required' };
  }

  const { segments, error } = memoryFolderSegments(
    input.scope,
    input.tool,
    input.project
  );
  if (error) return { error };

  const folderId = ensureFolderPath(segments);
  const mem_tool = input.scope === 'tool' ? (input.tool ?? '').trim() : null;
  const mem_project =
    input.scope === 'project' ? (input.project ?? '').trim() : null;
  const source_app = (input.source_app ?? '').trim() || null;
  const mem_tags = serializeTags(input.tags);
  const now = new Date().toISOString();

  const existing = getNoteByFolderAndTitle(folderId, title);
  const db = getDb();

  if (existing) {
    db.prepare(
      `UPDATE Note SET content = ?, mem_scope = ?, mem_tool = ?, mem_project = ?,
       source_app = ?, mem_tags = ?, updated_at = ? WHERE id = ?`
    ).run(
      input.content,
      input.scope,
      mem_tool,
      mem_project,
      source_app,
      mem_tags,
      now,
      existing.id
    );
    db.prepare('DELETE FROM Note_fts WHERE note_id = ?').run(existing.id);
    db.prepare('INSERT INTO Note_fts (note_id, title, content) VALUES (?, ?, ?)').run(
      existing.id,
      title,
      input.content
    );
    const note = getNote(existing.id);
    if (!note) return { error: 'failed to update memory' };
    return { action: 'updated', note };
  }

  const id = uuidv4();
  const sort_order = getMaxNoteSortOrder(folderId) + 1;
  db.prepare(
    `INSERT INTO Note (
      id, folder_id, title, content, created_at, updated_at, sort_order,
      mem_scope, mem_tool, mem_project, source_app, mem_tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    folderId,
    title,
    input.content,
    now,
    now,
    sort_order,
    input.scope,
    mem_tool,
    mem_project,
    source_app,
    mem_tags
  );
  db.prepare('INSERT INTO Note_fts (note_id, title, content) VALUES (?, ?, ?)').run(
    id,
    title,
    input.content
  );
  const note = getNote(id);
  if (!note) return { error: 'failed to create memory' };
  return { action: 'created', note };
}

/**
 * Recall memories for the current client context:
 * global ∪ (tool == tool) ∪ (project == project).
 * Optional query further filters via FTS5.
 */
export function recallMemory(input: RecallMemoryInput): RecallMemoryResult {
  const db = getDb();
  const tool = (input.tool ?? '').trim() || null;
  const project = (input.project ?? '').trim() || null;
  const ftsQuery = input.query ? toFtsQuery(input.query) : '';

  let rows: Note[];
  if (ftsQuery) {
    rows = db
      .prepare(
        `SELECT Note.* FROM Note
         JOIN Note_fts ON Note_fts.note_id = Note.id
         WHERE Note_fts MATCH ?
           AND (
             Note.mem_scope = 'global'
             OR (Note.mem_scope = 'tool' AND Note.mem_tool = ?)
             OR (Note.mem_scope = 'project' AND Note.mem_project = ?)
           )
         ORDER BY rank
         LIMIT 50`
      )
      .all(ftsQuery, tool, project) as Note[];
  } else {
    rows = db
      .prepare(
        `SELECT * FROM Note
         WHERE mem_scope = 'global'
            OR (mem_scope = 'tool' AND mem_tool = ?)
            OR (mem_scope = 'project' AND mem_project = ?)
         ORDER BY
           CASE mem_scope
             WHEN 'global' THEN 0
             WHEN 'tool' THEN 1
             WHEN 'project' THEN 2
             ELSE 3
           END,
           updated_at DESC
         LIMIT 100`
      )
      .all(tool, project) as Note[];
  }

  const result: RecallMemoryResult = {
    global: [],
    tool: [],
    project: [],
    count: 0,
  };
  for (const note of rows) {
    if (note.mem_scope === 'global') result.global.push(note);
    else if (note.mem_scope === 'tool') result.tool.push(note);
    else if (note.mem_scope === 'project') result.project.push(note);
  }
  result.count = result.global.length + result.tool.length + result.project.length;
  return result;
}

function generateApiKeyString(): string {
  return 'yq_' + uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 8);
}

export function listUsers(): User[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM User ORDER BY created_at ASC')
    .all() as User[];
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM User WHERE id = ?').get(id) as User | undefined;
  return row ?? null;
}

export function getUserByUsername(username: string): User | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM User WHERE username = ?')
    .get(username) as User | undefined;
  return row ?? null;
}

export function createUser(
  username: string,
  password: string,
  role: UserRole = 'user'
): User {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO User (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, hashPassword(password), role, now);
  return { id, username, password_hash: '', role, created_at: now };
}

export function deleteUser(id: string): boolean {
  const db = getDb();
  db.prepare('DELETE FROM ApiKey WHERE user_id = ?').run(id);
  const result = db.prepare('DELETE FROM User WHERE id = ?').run(id);
  return result.changes > 0;
}

export function createApiKey(
  userId: string,
  name: string = ''
): ApiKey {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const key = generateApiKeyString();
  db.prepare(
    'INSERT INTO ApiKey (id, user_id, key, name, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userId, key, name, now);
  return { id, user_id: userId, key, name, created_at: now };
}

export function listApiKeysByUser(userId: string): ApiKey[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM ApiKey WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as ApiKey[];
}

export function listAllApiKeys(): ApiKeyWithUsername[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT ApiKey.*, User.username AS username FROM ApiKey JOIN User ON ApiKey.user_id = User.id ORDER BY ApiKey.created_at DESC'
    )
    .all() as ApiKeyWithUsername[];
}

export function getApiKeyByKey(key: string): ApiKey | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM ApiKey WHERE key = ?').get(key) as ApiKey | undefined;
  return row ?? null;
}

export function getApiKeyById(id: string): ApiKey | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM ApiKey WHERE id = ?').get(id) as ApiKey | undefined;
  return row ?? null;
}

export function updateApiKey(id: string, name: string): ApiKey | null {
  const db = getDb();
  const existing = getApiKeyById(id);
  if (!existing) return null;
  db.prepare('UPDATE ApiKey SET name = ? WHERE id = ?').run(name, id);
  return { ...existing, name };
}

export function deleteApiKey(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM ApiKey WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteApiKeysByUser(userId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM ApiKey WHERE user_id = ?').run(userId);
  return result.changes;
}
