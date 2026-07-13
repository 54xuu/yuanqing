---
name: yuanqing-save-memory
description: >-
  Persist or update shared memories in cloud yuanqing via MCP save_memory.
  Use when the user says remember this, wants to update/change a memory, or when
  discovering durable preferences, tool-specific pitfalls, or project conventions.
  Triggers: 记住、沉淀记忆、更新记忆、修改记忆、save_memory、别忘了、以后都要。
---

# 沉淀 / 更新源清记忆（save_memory）

把可复用结论写回云端，Cursor / Trae 等端下次 `recall_memory` 都能读到。

## 何时调用

1. 用户明确说「记住」「以后都要」「别忘了」
2. 发现某工具特有踩坑（如 Trae 写 WSL 失败）
3. 确立当前仓库约定（部署、目录、命名）
4. 用户要求**修改**已有记忆 → 用**相同 title + 相同 scope** 再 save（覆盖更新）

## 三层判定

| 情况 | scope | 额外字段 |
|------|-------|----------|
| 与工具、项目都无关（语言、通用编码规范） | `global` | — |
| 只影响某个 Agent 应用 | `tool` | `tool` 必填 |
| 只影响当前仓库 | `project` | `project` 必填 |

`source_app` 填当前应用：`cursor` 或 `trae`。

## 怎么调用

新建或覆盖：

```
save_memory({
  scope: "global" | "tool" | "project",
  tool: "trae",           // scope=tool 时必填
  project: "yuanqing",    // scope=project 时必填
  title: "简短标题",       // 同 scope 下同 title = 覆盖更新
  content: "完整 Markdown 正文",
  source_app: "cursor",
  tags: ["可选"]
})
```

## 修改已有记忆

1. 先 `recall_memory`（或 Web UI / `get_note_by_path`）确认原 `title` 与 scope
2. 再 `save_memory`，**title / scope / tool|project 保持不变**，只改 `content`
3. 返回 `action: "updated"` 即成功

也可在源清 Web：打开 `全局记忆` / `工具记忆/<tool>` / `项目记忆/<项目>` 直接编辑笔记。

## 反例

- 不要用 `upsert_note` 写跨端记忆（无 `mem_scope`，召不回）
- 不要把 Trae 专属踩坑写成 `global`（会污染 Cursor）
- 不要把单仓约定写成 `global`

## 示例

```
save_memory({
  scope: "tool",
  tool: "trae",
  title: "WSL 项目写入规避",
  content: "Trae 对 WSL/UNC 路径写入常失败；优先在 Linux 侧写文件。",
  source_app: "cursor",
  tags: ["wsl"]
})
```

```
save_memory({
  scope: "project",
  project: "yuanqing",
  title: "打 tag 前同步版本号",
  content: "只改 package.json 的 version；UI 通过 lib/version.ts 显示 v{version}。",
  source_app: "cursor",
  tags: ["release"]
})
```
