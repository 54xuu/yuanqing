import { describe, it, expect, afterEach } from 'vitest';
import {
  handleSearchNotes,
  handleGetNote,
  handleGetNoteByPath,
  handleUpsertNote,
  handleSaveMemory,
  handleRecallMemory,
} from '../mcp-server/index';
import {
  createNote,
  deleteNote,
  deleteFolder,
  getNote,
  getFolderByParentAndName,
  getNoteByFolderAndTitle,
  searchNotes,
} from '../lib/db';

const createdNoteIds: string[] = [];
const createdFolderIds: string[] = [];

afterEach(() => {
  for (const id of createdNoteIds.splice(0)) {
    deleteNote(id);
  }
  for (const id of createdFolderIds.splice(0)) {
    deleteFolder(id);
  }
});

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

describe('handleSearchNotes', () => {
  it('returns { count, results } with matches for seeded content', async () => {
    const data = await handleSearchNotes({ query: '源清' });
    expect(typeof data.count).toBe('number');
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.count).toBe(data.results.length);
    expect(data.count).toBeGreaterThan(0);
    for (const r of data.results) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.title).toBe('string');
      expect(typeof r.summary).toBe('string');
    }
  });

  it('returns { count: 0, results: [] } for empty query', async () => {
    const data = await handleSearchNotes({ query: '' });
    expect(data.count).toBe(0);
    expect(data.results).toEqual([]);
  });

  it('returns { count: 0, results: [] } when nothing matches', async () => {
    const data = await handleSearchNotes({ query: 'zzzznotfound' });
    expect(data.count).toBe(0);
    expect(data.results).toEqual([]);
  });
});

describe('handleGetNote', () => {
  it('returns { error, id } for an invalid note id', async () => {
    const id = `invalid-${randomId()}`;
    const data = await handleGetNote({ id });
    expect(data).toEqual({ error: 'note not found', id });
  });

  it('returns { note } for a real note id', async () => {
    const title = `MCP Test ${randomId()}`;
    const content = `content-${randomId()}`;
    const created = createNote({ title, content });
    createdNoteIds.push(created.id);

    const data = await handleGetNote({ id: created.id });
    expect('note' in data).toBe(true);
    if ('note' in data) {
      expect(data.note.id).toBe(created.id);
      expect(data.note.title).toBe(title);
      expect(data.note.content).toBe(content);
    }
  });
});

describe('handleUpsertNote', () => {
  it('returns { error } for an empty path', async () => {
    const data = await handleUpsertNote({ path: '   ', content: 'x' });
    expect('error' in data).toBe(true);
  });

  it('creates a root-level note when the path has no slash', async () => {
    const title = `RootNote ${randomId()}`;
    const content = `body-${randomId()}`;
    const data = await handleUpsertNote({ path: title, content });
    expect('action' in data).toBe(true);
    if ('action' in data) {
      expect(data.action).toBe('created');
      expect(data.note.title).toBe(title);
      expect(data.note.content).toBe(content);
      expect(data.note.folder_id).toBeNull();
      createdNoteIds.push(data.note.id);
    }
  });

  it('creates the folder hierarchy and the note for a nested path', async () => {
    const folderName = `McpUpsertFolder ${randomId()}`;
    const title = `NestedNote ${randomId()}`;
    const content = `nested-${randomId()}`;
    const data = await handleUpsertNote({ path: `${folderName}/${title}`, content });
    expect('action' in data).toBe(true);
    if ('action' in data) {
      expect(data.action).toBe('created');
      expect(data.note.title).toBe(title);
      expect(data.note.content).toBe(content);
      createdNoteIds.push(data.note.id);

      const folder = getFolderByParentAndName(null, folderName);
      expect(folder).not.toBeNull();
      createdFolderIds.push(folder!.id);
      expect(data.note.folder_id).toBe(folder!.id);
    }
  });

  it('updates an existing note with the same title in the same folder', async () => {
    const folderName = `McpUpsertUpdate ${randomId()}`;
    const title = `UpdateNote ${randomId()}`;
    const firstContent = `first-${randomId()}`;
    const secondContent = `second-${randomId()}`;

    const created = await handleUpsertNote({
      path: `${folderName}/${title}`,
      content: firstContent,
    });
    let createdId: string | null = null;
    if ('action' in created) {
      createdNoteIds.push(created.note.id);
      createdId = created.note.id;
      const folder = getFolderByParentAndName(null, folderName);
      if (folder) createdFolderIds.push(folder.id);
    }

    const updated = await handleUpsertNote({
      path: `${folderName}/${title}`,
      content: secondContent,
    });
    expect('action' in updated).toBe(true);
    if ('action' in updated) {
      expect(updated.action).toBe('updated');
      expect(updated.note.id).toBe(createdId);
      expect(updated.note.content).toBe(secondContent);
      // FTS index should reflect the new content.
      const hits = searchNotes(secondContent);
      expect(hits.some((h) => h.id === updated.note.id)).toBe(true);
    }
  });

  it('trims leading/trailing slashes and treats the last segment as the title', async () => {
    const title = `SlashNote ${randomId()}`;
    const content = `slash-${randomId()}`;
    const data = await handleUpsertNote({ path: `/${title}/`, content });
    expect('action' in data).toBe(true);
    if ('action' in data) {
      expect(data.action).toBe('created');
      expect(data.note.title).toBe(title);
      expect(data.note.folder_id).toBeNull();
      createdNoteIds.push(data.note.id);
    }
  });

  it('getNoteByFolderAndTitle finds notes created by upsert', async () => {
    const title = `LookupNote ${randomId()}`;
    const content = `lookup-${randomId()}`;
    const data = await handleUpsertNote({ path: title, content });
    if ('action' in data) {
      createdNoteIds.push(data.note.id);
      const found = getNoteByFolderAndTitle(null, title);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(data.note.id);
      expect(getNote(data.note.id)).not.toBeNull();
    }
  });
});

describe('handleGetNoteByPath', () => {
  it('returns { note } for an existing nested path', async () => {
    const folderName = `PathFolder ${randomId()}`;
    const title = `PathNote ${randomId()}`;
    const content = `path-${randomId()}`;
    const upserted = await handleUpsertNote({ path: `${folderName}/${title}`, content });
    if ('action' in upserted) {
      createdNoteIds.push(upserted.note.id);
      const folder = getFolderByParentAndName(null, folderName);
      if (folder) createdFolderIds.push(folder.id);
    }

    const data = await handleGetNoteByPath({ path: `${folderName}/${title}` });
    expect('note' in data).toBe(true);
    if ('note' in data) {
      expect(data.note.title).toBe(title);
      expect(data.note.content).toBe(content);
    }
  });

  it('returns { error, path } for a non-existent path', async () => {
    const path = `MissingFolder ${randomId()}/MissingNote ${randomId()}`;
    const data = await handleGetNoteByPath({ path });
    expect('error' in data).toBe(true);
    if ('error' in data) {
      expect(data.error).toBe('note not found');
      expect(data.path).toBe(path);
    }
  });

  it('returns { error } for an empty path', async () => {
    const data = await handleGetNoteByPath({ path: '   ' });
    expect('error' in data).toBe(true);
  });
});

describe('handleSaveMemory / handleRecallMemory', () => {
  it('saves global / tool / project memories and recalls by scope', async () => {
    const suffix = randomId();
    const globalTitle = `全局偏好 ${suffix}`;
    const toolTitle = `Trae WSL 写入 ${suffix}`;
    const projectTitle = `yuanqing 部署 ${suffix}`;
    const uniqueToken = `memtoken${suffix}`;

    const globalSaved = await handleSaveMemory({
      scope: 'global',
      title: globalTitle,
      content: `# 全局\n输出使用简体中文。\n${uniqueToken}`,
      source_app: 'cursor',
      tags: ['preference'],
    });
    expect('action' in globalSaved).toBe(true);
    if ('action' in globalSaved) {
      expect(globalSaved.action).toBe('created');
      expect(globalSaved.note.mem_scope).toBe('global');
      expect(globalSaved.note.mem_tool).toBeNull();
      expect(globalSaved.note.mem_project).toBeNull();
      expect(globalSaved.note.source_app).toBe('cursor');
      createdNoteIds.push(globalSaved.note.id);
      const folder = getFolderByParentAndName(null, '全局记忆');
      if (folder) createdFolderIds.push(folder.id);
    }

    const toolSaved = await handleSaveMemory({
      scope: 'tool',
      tool: 'trae',
      title: toolTitle,
      content: `# Trae\nWSL 项目写入常失败，优先用 bash 侧写。\n${uniqueToken}`,
      source_app: 'trae',
    });
    expect('action' in toolSaved).toBe(true);
    if ('action' in toolSaved) {
      expect(toolSaved.action).toBe('created');
      expect(toolSaved.note.mem_scope).toBe('tool');
      expect(toolSaved.note.mem_tool).toBe('trae');
      createdNoteIds.push(toolSaved.note.id);
      const root = getFolderByParentAndName(null, '工具记忆');
      if (root) {
        createdFolderIds.push(root.id);
        const child = getFolderByParentAndName(root.id, 'trae');
        if (child) createdFolderIds.push(child.id);
      }
    }

    const projectSaved = await handleSaveMemory({
      scope: 'project',
      project: 'yuanqing',
      title: projectTitle,
      content: `# yuanqing\nPVC 需 entrypoint chown。\n${uniqueToken}`,
      source_app: 'cursor',
    });
    expect('action' in projectSaved).toBe(true);
    if ('action' in projectSaved) {
      expect(projectSaved.action).toBe('created');
      expect(projectSaved.note.mem_scope).toBe('project');
      expect(projectSaved.note.mem_project).toBe('yuanqing');
      createdNoteIds.push(projectSaved.note.id);
      const root = getFolderByParentAndName(null, '项目记忆');
      if (root) {
        createdFolderIds.push(root.id);
        const child = getFolderByParentAndName(root.id, 'yuanqing');
        if (child) createdFolderIds.push(child.id);
      }
    }

    // Cursor + yuanqing: should see global + project, NOT trae tool memory.
    const cursorRecall = await handleRecallMemory({
      tool: 'cursor',
      project: 'yuanqing',
    });
    expect(cursorRecall.global.some((n) => n.title === globalTitle)).toBe(true);
    expect(cursorRecall.project.some((n) => n.title === projectTitle)).toBe(true);
    expect(cursorRecall.tool.some((n) => n.title === toolTitle)).toBe(false);

    // Trae + yuanqing: should see global + trae tool + project.
    const traeRecall = await handleRecallMemory({
      tool: 'trae',
      project: 'yuanqing',
    });
    expect(traeRecall.global.some((n) => n.title === globalTitle)).toBe(true);
    expect(traeRecall.tool.some((n) => n.title === toolTitle)).toBe(true);
    expect(traeRecall.project.some((n) => n.title === projectTitle)).toBe(true);

    // Keyword filter within scope.
    const filtered = await handleRecallMemory({
      tool: 'trae',
      project: 'yuanqing',
      query: uniqueToken,
    });
    expect(filtered.count).toBeGreaterThanOrEqual(3);
    expect(
      [...filtered.global, ...filtered.tool, ...filtered.project].every((n) =>
        n.content.includes(uniqueToken)
      )
    ).toBe(true);
  });

  it('upserts memory with the same title under the same scope', async () => {
    const title = `UpsertMem ${randomId()}`;
    const first = await handleSaveMemory({
      scope: 'global',
      title,
      content: 'first version',
      source_app: 'cursor',
    });
    expect('action' in first && first.action === 'created').toBe(true);
    if ('action' in first) {
      createdNoteIds.push(first.note.id);
      const folder = getFolderByParentAndName(null, '全局记忆');
      if (folder) createdFolderIds.push(folder.id);
    }

    const second = await handleSaveMemory({
      scope: 'global',
      title,
      content: 'second version',
      source_app: 'trae',
    });
    expect('action' in second).toBe(true);
    if ('action' in second && 'action' in first) {
      expect(second.action).toBe('updated');
      expect(second.note.id).toBe(first.note.id);
      expect(second.note.content).toBe('second version');
      expect(second.note.source_app).toBe('trae');
    }
  });

  it('returns error when tool/project is missing for scoped saves', async () => {
    const missingTool = await handleSaveMemory({
      scope: 'tool',
      title: 'x',
      content: 'y',
    });
    expect('error' in missingTool).toBe(true);

    const missingProject = await handleSaveMemory({
      scope: 'project',
      title: 'x',
      content: 'y',
    });
    expect('error' in missingProject).toBe(true);
  });

  it('does not recall plain notes without mem_scope', async () => {
    const title = `PlainNote ${randomId()}`;
    const plain = createNote({ title, content: 'not a memory' });
    createdNoteIds.push(plain.id);
    expect(plain.mem_scope).toBeNull();

    const recalled = await handleRecallMemory({ tool: 'cursor', project: 'yuanqing' });
    expect(
      [...recalled.global, ...recalled.tool, ...recalled.project].some(
        (n) => n.id === plain.id
      )
    ).toBe(false);
  });
});
