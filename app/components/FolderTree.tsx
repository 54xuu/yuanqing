"use client";

import { useState } from "react";

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId: string | null | "all";
  onSelectFolder: (id: string | null | "all") => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
}: FolderTreeProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  // Group folders by parent_id for recursive rendering.
  const childrenByParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const siblings = childrenByParent.get(folder.parent_id) ?? [];
    siblings.push(folder);
    childrenByParent.set(folder.parent_id, siblings);
  }

  const rootFolders = childrenByParent.get(null) ?? [];

  const renderFolder = (folder: Folder, depth: number) => {
    const children = childrenByParent.get(folder.id) ?? [];
    const isSelected = selectedFolderId === folder.id;
    return (
      <div key={folder.id}>
        <div
          className={`folder-row${isSelected ? " selected" : ""}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={() => onSelectFolder(folder.id)}
        >
          <span className="folder-icon">📁</span>
          <span className="folder-name">{folder.name}</span>
        </div>
        {children.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  };

  const handleConfirm = () => {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      setNewName("");
      return;
    }
    onCreateFolder(name, null);
    setNewName("");
    setCreating(false);
  };

  const handleCancel = () => {
    setCreating(false);
    setNewName("");
  };

  return (
    <div className="folder-tree">
      <div className="pane-header">
        <span>文件夹</span>
        <button
          className="icon-btn"
          title="新建文件夹"
          onClick={() => setCreating(true)}
        >
          +
        </button>
      </div>

      <div
        className={`folder-row${selectedFolderId === "all" ? " selected" : ""}`}
        style={{ paddingLeft: 12 }}
        onClick={() => onSelectFolder("all")}
      >
        <span className="folder-icon">📚</span>
        <span className="folder-name">全部笔记</span>
      </div>

      <div
        className={`folder-row${selectedFolderId === null ? " selected" : ""}`}
        style={{ paddingLeft: 12 }}
        onClick={() => onSelectFolder(null)}
      >
        <span className="folder-icon">📄</span>
        <span className="folder-name">未分类</span>
      </div>

      {rootFolders.map((folder) => renderFolder(folder, 0))}

      {creating && (
        <div className="folder-create-form" style={{ paddingLeft: 12 }}>
          <input
            type="text"
            className="folder-create-input"
            placeholder="文件夹名称"
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              else if (e.key === "Escape") handleCancel();
            }}
          />
          <div className="folder-create-actions">
            <button className="small-btn" onClick={handleConfirm}>
              确定
            </button>
            <button className="small-btn" onClick={handleCancel}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
