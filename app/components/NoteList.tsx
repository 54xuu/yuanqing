"use client";

import { useState } from "react";
import type { Folder } from "./FolderTree";
import Toast from "./Toast";
import { copyTextWithFallback } from "@/lib/copyToClipboard";

export interface Note {
  id: string;
  folder_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
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
  folders?: Folder[];
  onSelectNote: (id: string) => void;
  onCreateNote?: () => void;
  onDeleteNote?: (id: string) => void;
  onUpdateNote?: (
    id: string,
    data: { title: string; folder_id: string | null; sort_order: number }
  ) => void;
  onClearSearch?: () => void;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function buildFolderPath(folderId: string, folders: Folder[]): string {
  const parts: string[] = [];
  let current: string | null = folderId;
  while (current) {
    const f = folders.find((x) => x.id === current);
    if (!f) break;
    parts.unshift(f.name);
    current = f.parent_id;
  }
  return parts.join("/");
}

function getNoteFullPath(note: Note, folders: Folder[]): string {
  const folderPath = note.folder_id ? buildFolderPath(note.folder_id, folders) : "";
  return folderPath ? `${folderPath}/${note.title}` : note.title;
}

interface TreeItem {
  id: string | null;
  name: string;
  depth: number;
}

function buildTreeItems(folders: Folder[]): TreeItem[] {
  const items: TreeItem[] = [];
  
  function buildTree(parentId: string | null, depth: number) {
    const children = folders
      .filter(f => f.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);
    
    for (const child of children) {
      items.push({ id: child.id, name: child.name, depth });
      buildTree(child.id, depth + 1);
    }
  }
  
  buildTree(null, 0);
  return items;
}

function getTreePrefix(depth: number): string {
  if (depth === 0) return "";
  return "└─ " + "   ".repeat(depth - 1);
}

interface TreeSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  folders: Folder[];
  placeholder?: string;
}

function TreeSelect({ value, onChange, folders, placeholder = "未分类" }: TreeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const treeItems: TreeItem[] = [
    { id: null, name: placeholder, depth: 0 },
    ...buildTreeItems(folders)
  ];
  
  const displayValue = value === null 
    ? placeholder 
    : (() => {
        const item = treeItems.find(t => t.id === value);
        return item ? getTreePrefix(item.depth) + item.name : placeholder;
      })();
  
  return (
    <div className="tree-select">
      <button
        type="button"
        className="tree-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        {displayValue}
      </button>
      {isOpen && (
        <div className="tree-select-dropdown">
          {treeItems.map(item => (
            <div
              key={item.id || "root"}
              className={`tree-select-option ${value === item.id ? "selected" : ""}`}
              onClick={() => {
                onChange(item.id);
                setIsOpen(false);
              }}
            >
              <span className="tree-prefix">{getTreePrefix(item.depth)}</span>
              {item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NoteList(props: NoteListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

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
    onUpdateNote,
    folders = [],
  } = props;

  const sortedNotes = notes.slice().sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const handleCopyPath = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullPath = getNoteFullPath(note, folders);
    const ok = copyTextWithFallback(fullPath, {
      onSuccess: () => {
        setToastMessage(`已复制路径: ${fullPath}`);
        setToastType("success");
        setToastVisible(true);
      },
      onFail: () => {
        setToastMessage("已打开手动复制窗口");
        setToastType("success");
        setToastVisible(true);
      },
    });
    if (ok) return;
  };

  return (
    <div className="note-list">
      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
      <div className="pane-header">
        <span className="pane-title">笔记列表</span>
        <button className="small-btn" onClick={onCreateNote}>
          新建笔记
        </button>
      </div>
      <div className="note-list-body">
        {sortedNotes.length === 0 ? (
          <div className="empty-state">暂无笔记</div>
        ) : (
          sortedNotes.map((note) => {
            const isSelected = selectedNoteId === note.id;
            const isEditing = editingId === note.id;
            return (
              <div key={note.id}>
                <div
                  className={"note-row" + (isSelected ? " selected" : "")}
                  onClick={() => onSelectNote(note.id)}
                >
                  <div className="note-row-top">
                    <div className="note-row-title">{note.title}</div>
                    <div className="note-row-actions">
                      <button
                        className="text-btn"
                        onClick={(e) => handleCopyPath(note, e)}
                        title="复制笔记路径"
                      >
                        复制路径
                      </button>
                      <button
                        className="text-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(note.id);
                          setEditTitle(note.title);
                          setEditFolderId(note.folder_id);
                          setEditSortOrder(note.sort_order);
                        }}
                      >
                        编辑
                      </button>
                    </div>
                  </div>
                  <div className="note-row-time">
                    {new Date(note.updated_at).toLocaleString("zh-CN")}
                  </div>
                </div>
                {isEditing && (
                  <div className="modal-overlay" onClick={() => setEditingId(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                      <div className="modal-title">编辑笔记</div>
                      <div className="modal-field">
                        <label>标题</label>
                        <input
                          type="text"
                          value={editTitle}
                          autoFocus
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      <div className="modal-field">
                        <label>文件夹</label>
                        <TreeSelect
                          value={editFolderId}
                          onChange={setEditFolderId}
                          folders={folders}
                          placeholder="未分类"
                        />
                      </div>
                      <div className="modal-field">
                        <label>排序</label>
                        <input
                          type="number"
                          value={editSortOrder}
                          onChange={(e) => setEditSortOrder(Number(e.target.value))}
                        />
                      </div>
                      <div className="modal-actions">
                        <button
                          className="small-btn danger-btn"
                          onClick={() => {
                            if (
                              window.confirm(
                                "确认删除笔记 \"" + note.title + "\" 吗？"
                              )
                            ) {
                              onDeleteNote?.(note.id);
                              setEditingId(null);
                            }
                          }}
                        >
                          删除
                        </button>
                        <button
                          className="small-btn"
                          onClick={() => setEditingId(null)}
                        >
                          取消
                        </button>
                        <button
                          className="small-btn primary"
                          onClick={() => {
                            const title = editTitle.trim();
                            if (!title) return;
                            onUpdateNote?.(note.id, {
                              title,
                              folder_id: editFolderId,
                              sort_order: editSortOrder,
                            });
                            setEditingId(null);
                          }}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
