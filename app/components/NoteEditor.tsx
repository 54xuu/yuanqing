"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Note } from "./NoteList";

interface NoteEditorProps {
  note: Note | null;
  onSave: (id: string, data: { title: string; content: string }) => void;
}

export default function NoteEditor({ note, onSave }: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(true);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setPreview(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  if (!note) {
    return (
      <div className="note-editor">
        <div className="editor-placeholder">请选择一条笔记</div>
      </div>
    );
  }

  return (
    <div className="note-editor">
      <div className="editor-toolbar">
        <button className="small-btn" onClick={() => setPreview((p) => !p)}>
          {preview ? "编辑" : "预览"}
        </button>
        <button
          className="small-btn primary"
          onClick={() => onSave(note.id, { title, content })}
        >
          保存
        </button>
      </div>
      <input
        className="editor-title"
        type="text"
        value={title}
        placeholder="标题"
        onChange={(e) => setTitle(e.target.value)}
      />
      {preview ? (
        <div className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          className="editor-content"
          value={content}
          placeholder="在这里输入 Markdown 内容..."
          onChange={(e) => setContent(e.target.value)}
        />
      )}
      <div className="editor-meta">
        更新于: {new Date(note.updated_at).toLocaleString("zh-CN")}
      </div>
    </div>
  );
}
