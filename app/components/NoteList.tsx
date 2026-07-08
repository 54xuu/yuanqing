"use client";

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

interface NoteListProps {
  mode: "list" | "search";
  notes?: Note[];
  selectedNoteId?: string | null;
  searchResults?: NoteSummary[];
  searchQuery?: string;
  onSelectNote: (id: string) => void;
  onCreateNote?: () => void;
  onDeleteNote?: (id: string) => void;
  onClearSearch?: () => void;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

export default function NoteList(props: NoteListProps) {
  if (props.mode === "search") {
    const {
      searchResults = [],
      searchQuery = "",
      onSelectNote,
      onClearSearch,
    } = props;
    return (
      <div className="note-list">
        <div className="pane-header">
          <span className="pane-title">
            搜索结果: &quot;{searchQuery}&quot;
          </span>
          <button className="small-btn" onClick={onClearSearch}>
            清除
          </button>
        </div>
        <div className="note-list-body">
          {searchResults.length === 0 ? (
            <div className="empty-state">无搜索结果</div>
          ) : (
            searchResults.map((result) => (
              <div
                key={result.id}
                className="note-row"
                onClick={() => onSelectNote(result.id)}
              >
                <div className="note-row-title">{result.title}</div>
                <div className="note-row-summary">
                  {truncate(result.summary, 80)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const {
    notes = [],
    selectedNoteId = null,
    onSelectNote,
    onCreateNote,
    onDeleteNote,
  } = props;

  return (
    <div className="note-list">
      <div className="pane-header">
        <span className="pane-title">笔记列表</span>
        <button className="small-btn" onClick={onCreateNote}>
          新建笔记
        </button>
      </div>
      <div className="note-list-body">
        {notes.length === 0 ? (
          <div className="empty-state">暂无笔记</div>
        ) : (
          notes.map((note) => {
            const isSelected = selectedNoteId === note.id;
            return (
              <div
                key={note.id}
                className={`note-row${isSelected ? " selected" : ""}`}
                onClick={() => onSelectNote(note.id)}
              >
                <div className="note-row-top">
                  <div className="note-row-title">{note.title}</div>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(`确认删除笔记 "${note.title}" 吗？`)
                      ) {
                        onDeleteNote?.(note.id);
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
                <div className="note-row-time">
                  {new Date(note.updated_at).toLocaleString("zh-CN")}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
