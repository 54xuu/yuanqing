import { describe, it, expect, afterEach } from 'vitest';
import { handleSearchNotes, handleGetNote, handleUpsertNote } from '../mcp-server/index';
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
