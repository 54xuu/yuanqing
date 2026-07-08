import { describe, it, expect, afterEach } from 'vitest';
import {
  toFtsQuery,
  searchNotes,
  createNote,
  getNote,
  updateNote,
  deleteNote,
  listNotes,
  createFolder,
  listFolders,
  getFolder,
  updateFolder,
  deleteFolder,
  type Note,
  type Folder,
} from '../lib/db';

// Track resources created during tests so we can clean them up and avoid
// cross-test contamination. The shared seeded DB always has 1 folder
// ("源清") and 2 notes ("自我介绍", "产品介绍").
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

describe('toFtsQuery', () => {
  it('returns empty string for empty input', () => {
    expect(toFtsQuery('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(toFtsQuery('   \t\n  ')).toBe('');
  });

  it('wraps a single token in double quotes', () => {
    expect(toFtsQuery('源清')).toBe('"源清"');
  });

  it('wraps and joins multiple tokens with spaces', () => {
    expect(toFtsQuery('a b')).toBe('"a" "b"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    expect(toFtsQuery('a"b')).toBe('"a""b"');
  });
});

describe('searchNotes', () => {
  it('returns [] for empty query', () => {
    expect(searchNotes('')).toEqual([]);
  });

  it('returns matches for a keyword present in seeded content', () => {
    const results = searchNotes('源清');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.title).toBe('string');
      expect(typeof r.summary).toBe('string');
    }
  });

  it('returns [] for a keyword that matches nothing', () => {
    expect(searchNotes('zzzznotfound')).toEqual([]);
  });
});

describe('note CRUD: createNote / getNote / deleteNote', () => {
  it('creates a note, retrieves it, then deletes it', () => {
    const title = `Test Note ${randomId()}`;
    const content = `body-${randomId()}`;
    const created = createNote({ title, content });
    createdNoteIds.push(created.id);

    expect(typeof created.id).toBe('string');
    expect(created.title).toBe(title);
    expect(created.content).toBe(content);
    expect(typeof created.created_at).toBe('string');
    expect(typeof created.updated_at).toBe('string');

    const fetched = getNote(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.title).toBe(title);
    expect(fetched!.content).toBe(content);

    expect(deleteNote(created.id)).toBe(true);
    // remove from cleanup list since we already deleted
    const idx = createdNoteIds.indexOf(created.id);
    if (idx >= 0) createdNoteIds.splice(idx, 1);
    expect(getNote(created.id)).toBeNull();
  });

  it('deleteNote returns false for a non-existent id', () => {
    expect(deleteNote('non-existent-id-' + randomId())).toBe(false);
  });
});

describe('updateNote', () => {
  it('updates title and content and refreshes the FTS index', () => {
    const created = createNote({ title: `Orig ${randomId()}`, content: 'original body' });
    createdNoteIds.push(created.id);

    const keyword = `superraretoken${randomId()}`;
    const newTitle = `Updated ${randomId()}`;
    const newContent = `new body containing ${keyword}`;

    // Before update, the keyword should not match anything.
    expect(searchNotes(keyword)).toEqual([]);

    const updated = updateNote(created.id, { title: newTitle, content: newContent });
    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(created.id);
    expect(updated!.title).toBe(newTitle);
    expect(updated!.content).toBe(newContent);
    expect(updated!.updated_at >= created.created_at).toBe(true);

    // FTS index must reflect the new content.
    const hits = searchNotes(keyword);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.id === created.id)).toBe(true);
  });

  it('returns null when updating a non-existent id', () => {
    expect(updateNote('non-existent-id-' + randomId(), { title: 'x' })).toBeNull();
  });
});

describe('listNotes', () => {
  it('returns an array with at least the 2 seeded notes', () => {
    const all = listNotes();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('listNotes(null) returns only notes whose folder_id is null', () => {
    const created = createNote({ title: `NoFolder ${randomId()}`, content: 'x' });
    createdNoteIds.push(created.id);

    const notes = listNotes(null);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(n.folder_id).toBeNull();
    }
    expect(notes.some((n) => n.id === created.id)).toBe(true);
  });

  it('listNotes(folderId) returns only notes in that folder', () => {
    const folder = createFolder(`ListNotesFolder ${randomId()}`, null);
    createdFolderIds.push(folder.id);

    const note = createNote({ folder_id: folder.id, title: `InFolder ${randomId()}`, content: 'y' });
    createdNoteIds.push(note.id);

    const notes = listNotes(folder.id);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(n.folder_id).toBe(folder.id);
    }
    expect(notes.some((n) => n.id === note.id)).toBe(true);
  });
});

describe('folder CRUD: createFolder / getFolder / updateFolder / deleteFolder', () => {
  it('creates, reads, updates, and deletes a folder', () => {
    const name = `Folder ${randomId()}`;
    const created = createFolder(name, null);
    createdFolderIds.push(created.id);

    expect(typeof created.id).toBe('string');
    expect(created.name).toBe(name);
    expect(created.parent_id).toBeNull();
    expect(typeof created.created_at).toBe('string');

    const fetched = getFolder(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.name).toBe(name);

    const newName = `Renamed ${randomId()}`;
    const updated = updateFolder(created.id, newName);
    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(created.id);
    expect(updated!.name).toBe(newName);

    expect(deleteFolder(created.id)).toBe(true);
    const idx = createdFolderIds.indexOf(created.id);
    if (idx >= 0) createdFolderIds.splice(idx, 1);
    expect(getFolder(created.id)).toBeNull();
  });

  it('deleteFolder returns false for a non-existent id', () => {
    expect(deleteFolder('non-existent-id-' + randomId())).toBe(false);
  });
});

describe('listFolders', () => {
  it('returns at least the 1 seeded folder', () => {
    const folders = listFolders();
    expect(Array.isArray(folders)).toBe(true);
    expect(folders.length).toBeGreaterThanOrEqual(1);
    expect(folders.some((f) => f.name === '源清')).toBe(true);
  });
});

describe('seed idempotency', () => {
  it('still reports exactly 2 seeded notes after cleanup', () => {
    // All test-created notes are removed in afterEach, so the only notes
    // left should be the 2 seeded ones.
    const all = listNotes();
    expect(all.length).toBe(2);
    const titles = all.map((n) => n.title).sort();
    expect(titles).toEqual(['产品介绍', '自我介绍']);
  });
});
