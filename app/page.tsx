"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FolderTree from "./components/FolderTree";
import NoteList from "./components/NoteList";
import NoteEditor from "./components/NoteEditor";
import type { Folder } from "./components/FolderTree";
import type { Note, NoteSummary } from "./components/NoteList";

type CurrentUser = {
  id: string;
  username: string;
  role: "admin" | "user";
};

export default function Home() {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<
    string | null | "all"
  >("all");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchResults, setSearchResults] = useState<NoteSummary[] | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") as
      | "light"
      | "dark"
      | null;
    if (current) setTheme(current);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          router.replace("/login?next=/");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {
        /* ignore */
      });
  }, [router]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }, [router]);

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
    try {
      const res = await fetch(`/api/notes/${id}`);
      if (!res.ok) throw new Error("failed to load note");
      const data = await res.json();
      setSelectedNote(data.note ?? null);
    } catch (err) {
      console.error(err);
      setSelectedNote(null);
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
        if (selectedFolderId === id) {
          setSelectedFolderId("all");
        }
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
          body: JSON.stringify({
            folder_id: folderId,
            title: "新建笔记",
            content: "",
          }),
        });
        if (!res.ok) throw new Error("failed to create note");
        const data = await res.json();
        await refreshNotes();
        if (data.note?.id) {
          selectNote(data.note.id);
        }
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
    async (id: string, payload: { title: string; content: string }) => {
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
      } catch (err) {
        console.error(err);
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

  const handleSearchSubmit = () => {
    runSearch(searchInput);
  };

  const handleSelectSearchResult = (id: string) => {
    selectNote(id);
    clearSearch();
  };

  const handleCreateNote = () => {
    const folderId = selectedFolderId === "all" ? null : selectedFolderId;
    createNote(folderId);
  };

  const visibleNotes: Note[] = (() => {
    if (selectedFolderId === "all") return notes;
    if (selectedFolderId === null)
      return notes.filter((n) => n.folder_id === null);
    return notes.filter((n) => n.folder_id === selectedFolderId);
  })();

  const isSearching = searchResults !== null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title-container"><div className="app-title">源清 YuanQing</div><div className="app-version">v1.5</div></div>
        <div className="app-header-right">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}
            aria-label="切换主题"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="搜索笔记..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (e.target.value === "") {
                  clearSearch();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchSubmit();
              }}
            />
            <button className="small-btn" onClick={handleSearchSubmit}>
              搜索
            </button>
          </div>
          {currentUser && <span>{currentUser.username}</span>}
          <a href="/admin">后台</a>
          <button className="link-btn" onClick={logout}>
            退出
          </button>
        </div>
      </header>

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
              onSelectNote={handleSelectSearchResult}
              onClearSearch={clearSearch}
            />
          ) : (
            <NoteList
              mode="list"
              notes={visibleNotes}
              selectedNoteId={selectedNoteId}
              onSelectNote={selectNote}
              onCreateNote={handleCreateNote}
              onDeleteNote={deleteNote}
              onUpdateNote={updateNote}
              folders={folders}
            />
          )}
        </section>

        <main className="pane pane-right">
          <NoteEditor note={selectedNote} onSave={saveNote} />
        </main>
      </div>
    </div>
  );
}
