"use client";

import { useEffect, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Note } from "./NoteList";
import Toast from "./Toast";

interface NoteEditorProps {
  note: Note | null;
  loading?: boolean;
  onSave: (id: string, data: { title: string; content: string }) => Promise<boolean>;
}

const LARGE_CONTENT_THRESHOLD = 50000;
const PREVIEW_MAX_CHARS = 50000;

export default function NoteEditor({ note, loading, onSave }: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setPreview(note.content.length <= LARGE_CONTENT_THRESHOLD);
    }
  }, [note?.id]);

  if (loading) {
    return (
      <div className="note-editor">
        <div className="editor-loading">
          <div className="loading-spinner" />
          <span>加载笔记中...</span>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="note-editor">
        <div className="editor-placeholder">请选择一条笔记</div>
      </div>
    );
  }

  const isLargeContent = content.length > LARGE_CONTENT_THRESHOLD;
  const previewContent = isLargeContent && preview
    ? content.slice(0, PREVIEW_MAX_CHARS)
    : content;
  const truncatedChars = isLargeContent && preview
    ? content.length - PREVIEW_MAX_CHARS
    : 0;

  const handleTogglePreview = () => {
    if (!preview) {
      startTransition(() => {
        setPreview(true);
      });
    } else {
      setPreview(false);
    }
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setToastMessage("标题不能为空");
      setToastType("error");
      setToastVisible(true);
      return;
    }
    setSaving(true);
    try {
      const ok = await onSave(note.id, { title: trimmedTitle, content });
      if (ok) {
        setToastMessage(`已保存: ${trimmedTitle}`);
        setToastType("success");
      } else {
        setToastMessage("保存失败，请重试");
        setToastType("error");
      }
      setToastVisible(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="note-editor">
      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
      <div className="editor-toolbar">
        <button className="small-btn" onClick={handleTogglePreview}>
          {preview ? "编辑" : "预览"}
        </button>
        <button
          className="small-btn primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {isLargeContent && (
          <span className="large-content-warning">
            内容较长（{content.length.toLocaleString()} 字符）
          </span>
        )}
      </div>
      <input
        className="editor-title"
        type="text"
        value={title}
        placeholder="标题"
        onChange={(e) => setTitle(e.target.value)}
      />
      {preview ? (
        <>
          {isPending && (
            <div className="editor-loading">
              <div className="loading-spinner" />
              <span>渲染预览中...</span>
            </div>
          )}
          <div className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent}</ReactMarkdown>
            {truncatedChars > 0 && (
              <div className="preview-truncated-notice">
                内容过长，仅显示前 {PREVIEW_MAX_CHARS.toLocaleString()} 字符，
                还有 {truncatedChars.toLocaleString()} 字符未显示。
                请切换到编辑模式查看完整内容。
              </div>
            )}
          </div>
        </>
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
        {" | "}
        字符数: {content.length.toLocaleString()}
      </div>
    </div>
  );
}
