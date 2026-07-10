import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from './password';

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  folder_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
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
}

const INTRO_NOTE_CONTENT = `# 自我介绍

你好，我是张源（Zhang Yuan），一名专注于知识工具与开发者体验的软件工程师。

## 简介
- 目前主导源清（YuanQing）项目，专注于本地优先的知识管理工具与 AI Agent 集成
- 5 年全栈开发经验，擅长 TypeScript、Node.js、React 与 SQLite
- 热衷于把复杂的检索与上下文管理问题，转化为简洁可复用的工程方案

## 技能栈
- 前端：React 19、Next.js（App Router）、TailwindCSS
- 后端：Node.js、Next.js API Routes、better-sqlite3
- AI 集成：MCP（Model Context Protocol）、Prompt 工程、向量检索
- 工程化：Vitest、GitHub Actions、Docker

## 联系方式
- Email：zhangyuan@example.com
- GitHub：github.com/zhangyuan

把这条笔记交给 AI，它就能在对话中准确还原我的身份与背景。
`;

const PRODUCT_NOTE_CONTENT = `# 产品介绍：源清（YuanQing）

## 定位
源清是一款本地优先（local-first）的私有知识库，沉淀你的个人上下文，并通过 MCP Server 让任意支持 MCP 的 AI Agent 自动检索读取。

## 核心痛点
1. **重复喂料**：每次和不同 AI 对话都要重新粘贴自我介绍、产品背景
2. **信息孤岛**：笔记散落在多个应用，AI 无法统一访问
3. **检索困难**：长文档里找不到关键句，人工翻阅效率低

## 解决方案
- 用 SQLite + FTS5 提供毫秒级全文检索
- 用 Folder/Note 结构化组织个人上下文
- 暴露 MCP 工具 \`search_notes(query)\` 与 \`get_note(id)\`，Agent 主动按需拉取

## 目标用户
- 频繁与多个 AI Agent 协作的开发者
- 需要稳定可复用「人设/产品背景」的独立开发者与小团队
- 重视数据私有、希望本地存储的从业者

## MCP 集成
源清自带一个 stdio 模式的 MCP Server，可在 Claude Desktop、Trae 等支持 MCP 的客户端中直接配置，无需额外认证。Agent 调用 \`search_notes\` 获取候选笔记摘要，再调用 \`get_note\` 读取完整 Markdown，即可在对话中引用你的知识。
`;

function seedIfEmpty(db: DB): void {
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM Note').get() as { cnt: number };
  if (row.cnt > 0) return;

  const now = new Date().toISOString();

  const folderId = uuidv4();
  db.prepare(
    'INSERT INTO Folder (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)'
  ).run(folderId, '源清', null, now);

  const introId = uuidv4();
  db.prepare(
    'INSERT INTO Note (id, folder_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(introId, folderId, '自我介绍', INTRO_NOTE_CONTENT, now, now);
  db.prepare(
    'INSERT INTO Note_fts (note_id, title, content) VALUES (?, ?, ?)'
  ).run(introId, '自我介绍', INTRO_NOTE_CONTENT);

  const productId = uuidv4();
  db.prepare(
    'INSERT INTO Note (id, folder_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(productId, folderId, '产品介绍', PRODUCT_NOTE_CONTENT, now, now);
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
  db.prepare(
    'INSERT INTO User (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, 'admin', hashPassword('Admin@123'), 'admin', now);
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

// ---------- Folders ----------

export function listFolders(): Folder[] {
  const db = getDb();
  return db.prepare('SELECT * FROM Folder ORDER BY name ASC').all() as Folder[];
}

export function createFolder(name: string, parent_id: string | null): Folder {
  const db = getDb();
  const id = uuidv4();
  const created_at = new Date().toISOString();
  db.prepare(
    'INSERT INTO Folder (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, name, parent_id, created_at);
  return { id, name, parent_id, created_at };
}

export function getFolder(id: string): Folder | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM Folder WHERE id = ?').get(id) as Folder | undefined;
  return row ?? null;
}

export function updateFolder(id: string, name: string): Folder | null {
  const db = getDb();
  const result = db.prepare('UPDATE Folder SET name = ? WHERE id = ?').run(name, id);
  if (result.changes === 0) return null;
  return getFolder(id);
}

export function deleteFolder(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM Folder WHERE id = ?').run(id);
  return result.changes > 0;
}

// ---------- Notes ----------

export function listNotes(folder_id?: string | null): Note[] {
  const db = getDb();
  if (folder_id === undefined) {
    return db.prepare('SELECT * FROM Note ORDER BY updated_at DESC').all() as Note[];
  }
  return db
    .prepare('SELECT * FROM Note WHERE folder_id IS ? ORDER BY updated_at DESC')
    .all(folder_id) as Note[];
}

export function createNote(input: {
  folder_id?: string | null;
  title: string;
  content?: string;
}): Note {
  const db = getDb();
  const id = uuidv4();
  const folder_id = input.folder_id ?? null;
  const title = input.title;
  const content = input.content ?? '';
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO Note (id, folder_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, folder_id, title, content, now, now);
  db.prepare('INSERT INTO Note_fts (note_id, title, content) VALUES (?, ?, ?)').run(
    id,
    title,
    content
  );

  return { id, folder_id, title, content, created_at: now, updated_at: now };
}

export function getNote(id: string): Note | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM Note WHERE id = ?').get(id) as Note | undefined;
  return row ?? null;
}

export function updateNote(
  id: string,
  input: { title?: string; content?: string }
): Note | null {
  const db = getDb();
  const existing = getNote(id);
  if (!existing) return null;

  const title = input.title ?? existing.title;
  const content = input.content ?? existing.content;
  const updated_at = new Date().toISOString();

  db.prepare('UPDATE Note SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(
    title,
    content,
    updated_at,
    id
  );

  db.prepare('DELETE FROM Note_fts WHERE note_id = ?').run(id);
  db.prepare('INSERT INTO Note_fts (note_id, title, content) VALUES (?, ?, ?)').run(
    id,
    title,
    content
  );

  return { ...existing, title, content, updated_at };
}

export function deleteNote(id: string): boolean {
  const db = getDb();
  db.prepare('DELETE FROM Note_fts WHERE note_id = ?').run(id);
  const result = db.prepare('DELETE FROM Note WHERE id = ?').run(id);
  return result.changes > 0;
}

// ---------- Search ----------

export function toFtsQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(' ');
}

export function searchNotes(query: string): NoteSummary[] {
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) return [];
  const db = getDb();
  return db
    .prepare(
      `SELECT note_id AS id, title, snippet(Note_fts, 2, '', '', '...', 24) AS summary
       FROM Note_fts
       WHERE Note_fts MATCH ?
       ORDER BY rank
       LIMIT 20`
    )
    .all(ftsQuery) as NoteSummary[];
}

// ---------- Users ----------

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
  // SQLite needs PRAGMA foreign_keys=ON to cascade; do explicit cleanup to be safe.
  db.prepare('DELETE FROM ApiKey WHERE user_id = ?').run(id);
  const result = db.prepare('DELETE FROM User WHERE id = ?').run(id);
  return result.changes > 0;
}

// ---------- API Keys ----------

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
      `SELECT ApiKey.*, User.username AS username
       FROM ApiKey JOIN User ON ApiKey.user_id = User.id
       ORDER BY ApiKey.created_at DESC`
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
