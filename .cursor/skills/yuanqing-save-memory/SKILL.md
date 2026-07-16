---
name: yuanqing-save-memory
description: >-
  Persist or update shared memories in cloud yuanqing via MCP save_memory.
  Use when the user says remember this, wants to update/change a memory, or
  when discovering durable preferences, tool-specific pitfalls, or project
  conventions. Triggers: 记住、沉淀记忆、更新记忆、修改记忆、save_memory、别忘了、以后都要。
---

# 沉淀源清记忆（save_memory）

把可复用结论写回云端，Cursor / OpenCode 等端下次 `recall_memory` 都能读到。

## 何时调用

1. 用户明确表达持久偏好（如「以后用简体中文」）
2. 发现某工具特有踩坑（如 OpenCode 路径问题）
3. 确立本仓库独有约定或踩坑

## 怎么调用

`source_app` 填当前应用：`cursor` 或 `opencode`。

```
save_memory({
  scope: "global" | "tool" | "project",
  tool: "opencode",       // scope=tool 时必填
  project: "yuanqing",    // scope=project 时必填
  title: "短标题",
  content: "完整 Markdown 正文",
  source_app: "cursor",
  tags: ["deploy"]
})
```

## 作用域

| scope | 何时用 |
| --- | --- |
| `global` | 与工具/项目无关（语言、编码规范） |
| `tool` | 仅某 Agent 应用（必须 `tool=cursor/opencode`） |
| `project` | 仅当前仓库（必须 `project=<目录名>`） |

## 注意

- 同 scope + 同 title **覆盖更新**，更新前先 recall 或确认 title
- 不要把 OpenCode 专属踩坑写成 `global`（会污染 Cursor）
- 记忆内容在云端，**勿写入 git 仓库**

## 示例

```
save_memory({
  scope: "tool",
  tool: "opencode",
  title: "全局 AGENTS 路径",
  content: "个人全局指令放 ~/.config/opencode/AGENTS.md，勿提交 git。",
  source_app: "opencode"
})
```
