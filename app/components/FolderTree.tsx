"use client";

import { useMemo, useState } from "react";

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  sort_order: number;
}

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId: string | null | "all";
  onSelectFolder: (id: string | null | "all") => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onUpdateFolder: (
    id: string,
    data: { name: string; parent_id: string | null; sort_order: number }
  ) => void;
  onDeleteFolder: (id: string) => void;
}

function getDescendantIds(folderId: string, folders: Folder[]): Set<string> {
  const result = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.add(current);
    for (const f of folders) {
      if (f.parent_id === current && !result.has(f.id)) {
        stack.push(f.id);
      }
    }
  }
  return result;
}

function buildPathLabel(folderId: string, folders: Folder[]): string {
  const parts: string[] = [];
  let current: string | null = folderId;
  while (current) {
    const f = folders.find((x) => x.id === current);
    if (!f) break;
    parts.unshift(f.name);
    current = f.parent_id;
  }
  return parts.join(" / ");
}

interface TreeItem {
  id: string | null;
  name: string;
  depth: number;
}

function buildTreeItems(folders: Folder[], excludeFolderId?: string): TreeItem[] {
  const items: TreeItem[] = [];
  
  function buildTree(parentId: string | null, depth: number) {
    const children = folders
      .filter(f => f.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);
    
    for (const child of children) {
      if (excludeFolderId && child.id === excludeFolderId) continue;
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
  excludeFolderId?: string;
  placeholder?: string;
}

function TreeSelect({ value, onChange, folders, excludeFolderId, placeholder = "根目录" }: TreeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const treeItems: TreeItem[] = [
    { id: null, name: placeholder, depth: 0 },
    ...buildTreeItems(folders, excludeFolderId)
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

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
}: FolderTreeProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [editSortOrder, setEditSortOrder] = useState(0);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Folder[]>();
    for (const folder of folders) {
      const siblings = map.get(folder.parent_id) ?? [];
      siblings.push(folder);
      map.set(folder.parent_id, siblings);
    }
    return map;
  }, [folders]);

  const rootFolders = childrenByParent.get(null) ?? [];

  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => a.sort_order - b.sort_order);
  }, [folders]);

  const renderFolder = (folder: Folder, depth: number) => {
    const children = (childrenByParent.get(folder.id) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const isSelected = selectedFolderId === folder.id;
    const isEditing = editingId === folder.id;
    return (
      <div key={folder.id}>
        <div
          className={"folder-row" + (isSelected ? " selected" : "")}
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={() => onSelectFolder(folder.id)}
        >
          <span className="folder-icon">📁</span>
          <span className="folder-name">{folder.name}</span>
          <button
            className="text-btn"
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(folder.id);
              setEditName(folder.name);
              setEditParentId(folder.parent_id);
              setEditSortOrder(folder.sort_order);
            }}
          >
            编辑
          </button>
        </div>
        {children.map((child) => renderFolder(child, depth + 1))}
        {isEditing && (
          <div className="modal-overlay" onClick={() => setEditingId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">编辑文件夹</div>
              <div className="modal-field">
                <label>名称</label>
                <input
                  type="text"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="modal-field">
                <label>上一级</label>
                <TreeSelect
                  value={editParentId}
                  onChange={setEditParentId}
                  folders={folders}
                  excludeFolderId={folder.id}
                  placeholder="根目录"
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
                    if (window.confirm("确认删除文件夹 \"" + folder.name + "\" 吗？子文件夹将变为根级，笔记将变为未分类。")) {
                      onDeleteFolder(folder.id);
                      setEditingId(null);
                    }
                  }}
                >
                  删除
                </button>
                <button className="small-btn" onClick={() => setEditingId(null)}>
                  取消
                </button>
                <button
                  className="small-btn primary"
                  onClick={() => {
                    const name = editName.trim();
                    if (!name) return;
                    onUpdateFolder(folder.id, {
                      name,
                      parent_id: editParentId,
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
  };

  const handleConfirm = () => {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      setNewName("");
      setNewParentId(null);
      return;
    }
    onCreateFolder(name, newParentId);
    setNewName("");
    setNewParentId(null);
    setCreating(false);
  };

  const handleCancel = () => {
    setCreating(false);
    setNewName("");
    setNewParentId(null);
  };

  return (
    <div className="folder-tree">
      <div className="pane-header">
        <span>文件夹</span>
        <button
          className="icon-btn"
          title="新建文件夹"
          onClick={() => {
            setNewParentId(
              selectedFolderId !== "all" && selectedFolderId !== null
                ? selectedFolderId
                : null
            );
            setCreating(true);
          }}
        >
          +
        </button>
      </div>

      <div
        className={"folder-row" + (selectedFolderId === "all" ? " selected" : "")}
        style={{ paddingLeft: 12 }}
        onClick={() => onSelectFolder("all")}
      >
        <span className="folder-icon">📚</span>
        <span className="folder-name">全部笔记</span>
      </div>

      <div
        className={"folder-row" + (selectedFolderId === null ? " selected" : "")}
        style={{ paddingLeft: 12 }}
        onClick={() => onSelectFolder(null)}
      >
        <span className="folder-icon">📄</span>
        <span className="folder-name">未分类</span>
      </div>

      {rootFolders
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((folder) => renderFolder(folder, 0))}

      {creating && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">新建文件夹</div>
            <div className="modal-field">
              <label>名称</label>
              <input
                type="text"
                placeholder="文件夹名称"
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirm();
                  else if (e.key === "Escape") handleCancel();
                }}
              />
            </div>
            <div className="modal-field">
              <label>上一级</label>
              <TreeSelect
                value={newParentId}
                onChange={setNewParentId}
                folders={folders}
                placeholder="根目录"
              />
            </div>
            <div className="modal-actions">
              <button className="small-btn" onClick={handleCancel}>
                取消
              </button>
              <button className="small-btn primary" onClick={handleConfirm}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
