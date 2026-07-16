---
name: yuanqing-recall-memory
description: >-
  Recall shared cross-app memories from cloud yuanqing via MCP recall_memory.
  Use at session start, when switching projects/tasks, or when the user asks
  what was remembered / preferences / past pitfalls. Triggers: 召回记忆、加载记忆、
  recall_memory、记得什么、用户偏好、踩坑。
---

# 召回源清记忆（recall_memory）

云端源清是唯一记忆真源。通过 MCP 工具 `recall_memory` 拉取当前上下文应遵守的记忆。

## 何时调用

- 开始实质性工作之前（会话开始）
- 切换仓库 / 项目 / 任务主题时
- 用户问「之前记得什么」「我的偏好是什么」

## 怎么调用

```
recall_memory({
  tool: "<当前应用>",      // cursor | opencode
  project: "<当前仓库目录名>", // 如 yuanqing；无关项目时可省略
  query: "<可选关键词>"     // 收窄召回
})
```

返回 `{ global, tool, project, count }`：

- `global`：所有端共享偏好
- `tool`：仅 `tool` 参数匹配的工具记忆
- `project`：仅当前项目记忆

将返回内容纳入上下文并遵守。普通笔记仍可用 `search_notes` / `get_note`。

## 示例

在 Cursor 开发 yuanqing：

```
recall_memory({ tool: "cursor", project: "yuanqing" })
```

在 OpenCode 办公、无具体仓库：

```
recall_memory({ tool: "opencode" })
```
