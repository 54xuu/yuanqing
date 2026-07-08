import { describe, it, expect, afterEach } from 'vitest';
import { handleSearchNotes, handleGetNote } from '../mcp-server/index';
import { createNote, deleteNote } from '../lib/db';

const createdNoteIds: string[] = [];

afterEach(() => {
  for (const id of createdNoteIds.splice(0)) {
    deleteNote(id);
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
