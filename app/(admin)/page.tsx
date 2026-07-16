"use client";

import { Input, Button, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FolderTree from "../components/FolderTree";
import NoteList from "../components/NoteList";
import NoteEditor from "../components/NoteEditor";
import type { Folder } from "../components/FolderTree";
import type { Note, NoteSummary } from "../components/NoteList";

export default function NotesPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | "all">("all");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchResults, setSearchResults] = useState<NoteSummary[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [loadingNote, setLoadingNote] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  const refreshFolders = useCallback(async () => {
    try {
      setFoldersError(null);
      const res = await fetch("/api/folders");
      if (res.status === 401) {
        router.replace("/login?next=/");
        return;
      }
      if (!res.ok) throw new Error("failed to load folders");
      const data = await res.json();
      setFolders(data.folders ?? []);
    } catch (err) {
      console.error(err);
      setFoldersError("加载文件夹失败");
    } finally {
      setLoadingFolders(false);
    }
  }, [router]);

  const refreshNotes = useCallback(async () => {
    try {
      setNotesError(null);
      const res = await fetch("/api/notes");
      if (!res.ok) throw new Error("failed to load notes");
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch (err) {
      console.error(err);
      setNotesError("加载笔记失败");
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    refreshFolders();
    refreshNotes();
  }, [refreshFolders, refreshNotes]);

  const selectFolder = useCallback((id: string | null | "all") => {
    setSelectedFolderId(id);
    setSearchResults(null);
    setSearchQuery("");
    setSearchInput("");
  }, []);

  const selectNote = useCallback(async (id: string) => {
    setSelectedNoteId(id);
    setLoadingNote(true);
    try {
      const res = await fetch(`/api/notes/${id}`);
      if (!res.ok) throw new Error("failed to load note");
      const data = await res.json();
      setSelectedNote(data.note ?? null);
    } catch (err) {
      console.error(err);
      setSelectedNote(null);
    } finally {
      setLoadingNote(false);
    }
  }, []);

  const createFolder = useCallback(
    async (name: string, parentId: string | null) => {
      try {
        const res = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, parent_id: parentId }),
        });
        if (!res.ok) throw new Error("failed to create folder");
        await refreshFolders();
      } catch (err) {
        console.error(err);
      }
    },
    [refreshFolders]
  );

  const updateFolder = useCallback(
    async (
      id: string,
      data: { name: string; parent_id: string | null; sort_order: number }
    ) => {
      try {
        const res = await fetch(`/api/folders/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (err?.error) alert(err.error);
          throw new Error("failed to update folder");
        }
        await refreshFolders();
      } catch (err) {
        console.error(err);
      }
    },
    [refreshFolders]
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("failed to delete folder");
        if (selectedFolderId === id) setSelectedFolderId("all");
        await refreshFolders();
        await refreshNotes();
      } catch (err) {
        console.error(err);
      }
    },
    [refreshFolders, refreshNotes, selectedFolderId]
  );

  const createNote = useCallback(
    async (folderId: string | null) => {
      try {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder_id: folderId, title: "新建笔记", content: "" }),
        });
        if (!res.ok) throw new Error("failed to create note");
        const data = await res.json();
        await refreshNotes();
        if (data.note?.id) selectNote(data.note.id);
      } catch (err) {
        console.error(err);
      }
    },
    [refreshNotes, selectNote]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("failed to delete note");
        await refreshNotes();
        if (selectedNoteId === id) {
          setSelectedNoteId(null);
          setSelectedNote(null);
        }
      } catch (err) {
        console.error(err);
      }
    },
    [refreshNotes, selectedNoteId]
  );

  const saveNote = useCallback(
    async (id: string, payload: { title: string; content: string }): Promise<boolean> => {
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("failed to save note");
        const data = await res.json();
        await refreshNotes();
        setSelectedNote(data.note ?? null);
        return true;
      } catch (err) {
        console.error(err);
        return false;
      }
    },
    [refreshNotes]
  );

  const updateNote = useCallback(
    async (
      id: string,
      data: { title: string; folder_id: string | null; sort_order: number }
    ) => {
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("failed to update note");
        await refreshNotes();
        if (selectedNoteId === id) {
          const r = await fetch(`/api/notes/${id}`);
          if (r.ok) {
            const d = await r.json();
            setSelectedNote(d.note ?? null);
          }
        }
      } catch (err) {
        console.error(err);
      }
    },
    [refreshNotes, selectedNoteId]
  );

  const runSearch = useCallback(async (q: string) => {
    const query = q.trim();
    setSearchQuery(query);
    if (!query) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("failed to search");
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    }
  }, []);

  const clearSearch = () => {
    setSearchResults(null);
    setSearchQuery("");
    setSearchInput("");
  };

  const visibleNotes: Note[] = (() => {
    if (selectedFolderId === "all") return notes;
    if (selectedFolderId === null) return notes.filter((n) => n.folder_id === null);
    return notes.filter((n) => n.folder_id === selectedFolderId);
  })();

  const isSearching = searchResults !== null;

  return (
    <div className="app app-in-shell">
      <div className="app-toolbar">
        <Space>
          <Input
            placeholder="搜索笔记..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (e.target.value === "") clearSearch();
            }}
            onPressEnter={() => runSearch(searchInput)}
            style={{ width: 280 }}
            allowClear
          />
          <Button icon={<SearchOutlined />} onClick={() => runSearch(searchInput)}>
            搜索
          </Button>
        </Space>
      </div>
      <div className="app-body">
        <aside className="pane pane-left">
          {loadingFolders ? (
            <div className="empty-state">加载中...</div>
          ) : foldersError ? (
            <div className="empty-state">{foldersError}</div>
          ) : (
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={selectFolder}
              onCreateFolder={createFolder}
              onUpdateFolder={updateFolder}
              onDeleteFolder={deleteFolder}
            />
          )}
        </aside>
        <section className="pane pane-middle">
          {loadingNotes ? (
            <div className="empty-state">加载中...</div>
          ) : notesError ? (
            <div className="empty-state">{notesError}</div>
          ) : isSearching ? (
            <NoteList
              mode="search"
              searchResults={searchResults ?? []}
              searchQuery={searchQuery}
              onSelectNote={(id) => {
                selectNote(id);
                clearSearch();
              }}
              onClearSearch={clearSearch}
            />
          ) : (
            <NoteList
              mode="list"
              notes={visibleNotes}
              selectedNoteId={selectedNoteId}
              onSelectNote={selectNote}
              onCreateNote={() =>
                createNote(selectedFolderId === "all" ? null : selectedFolderId)
              }
              onDeleteNote={deleteNote}
              onUpdateNote={updateNote}
              folders={folders}
            />
          )}
        </section>
        <main className="pane pane-right">
          <NoteEditor note={selectedNote} loading={loadingNote} onSave={saveNote} />
        </main>
      </div>
    </div>
  );
}
