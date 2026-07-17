# OpenCode 全局记忆指令（模板）

> **复制说明（勿提交 git）**
>
> | 文件 | 复制到 |
> |------|--------|
> | 本文件 | `~/.config/opencode/AGENTS.md`（Windows：`C:\Users\xujia\.config\opencode\AGENTS.md`） |
> | `opencode-plugins/yuanqing-memory.ts` | `~/.config/opencode/plugins/yuanqing-memory.ts` |
>
> 含 API Key 的 `opencode.json` 同样**不得提交 git**。记忆正文只在云端，运行时经 MCP 拉取。

## 源清跨应用记忆

云端源清（yuanqing）是唯一记忆真源。本端标识：`tool=opencode`。

### 会话开始

在实质性工作前，若已配置 yuanqing MCP，调用：

```
recall_memory({ tool: "opencode", project: "<当前仓库目录名>" })
```

将返回的 global / tool / project 记忆纳入上下文并遵守。

### 自动触发记忆

除会话开始外，以下场景**必须主动调用** yuanqing MCP，不要只口头回复或只写本地文件。

#### 获取记忆（recall_memory）

**软触发（需自行判断）**

当用户提到的信息、偏好、约定、踩坑或项目规则在当前上下文中**不存在或不确定**时，先调用 `recall_memory` 再回答或动手改代码。

**硬触发（关键词，立即调用）**

用户消息出现下列表述时，**本条消息内**立刻调用 `recall_memory`：

| 用户表述 | 侧重 scope | 调用示例 |
|----------|------------|----------|
| 回忆项目记忆 / 获取项目记忆 | project | `recall_memory({ tool: "opencode", project: "<当前仓库目录名>", query: "项目" })` |
| 回忆工具记忆 / 获取工具记忆 | tool | `recall_memory({ tool: "opencode", project: "<当前仓库目录名>", query: "工具" })` |
| 回忆全局记忆 / 获取全局记忆 | global | `recall_memory({ tool: "opencode", query: "全局" })` |
| 回忆记忆 / 获取记忆 / 召回记忆 / 加载记忆 / recall_memory | 全量 | `recall_memory({ tool: "opencode", project: "<当前仓库目录名>" })` |

返回 `{ global, tool, project, count }` 后，将相关内容纳入上下文并遵守；若某层为空，明确告知用户。

#### 保存记忆（save_memory）

**硬触发（关键词，立即调用）**

用户消息出现「永久记住」「需要永久记住」「保存记忆」「记住」「以后都要」「别忘了」「save_memory」等表述时，**本条消息内**调用 `save_memory`（`source_app: "opencode"`），不要只写本地 AGENTS.md 代替云端。

**三层 scope 判定**

| 情况 | scope | 额外字段 |
|------|-------|----------|
| 与工具、项目都无关（语言、通用编码规范） | `global` | — |
| 只影响 OpenCode 或其它 Agent 应用 | `tool` | `tool: "opencode"` |
| 只影响当前仓库 | `project` | `project: "<当前仓库目录名>"` |

**修改已有记忆**：先 `recall_memory` 确认原 `title` 与 scope，再 `save_memory` 保持 title/scope 不变只改 `content`（同 title 同 scope = 覆盖更新）。

**反例**

- 不要用 `upsert_note` 写跨端记忆（无 `mem_scope`，召不回）
- 不要把 OpenCode 专属踩坑写成 `global`
- 不要把单仓约定写成 `global`

### 沉淀记忆（补充）

用户表达持久偏好、发现工具踩坑或项目约定时，即使未说「记住」等关键词，也应调用 `save_memory`（`source_app=opencode`），不要只写本地文件代替云端。

### Skill 目录

OpenCode Skill：`~/.config/opencode/skills/<name>/`

下载云端 skill：对 Agent 说「把 yuanqing-recall-memory 下载到 ~/.config/opencode/skills」。

### 安全

- 此文件、`plugins/yuanqing-memory.ts` 与 `opencode.json` 中的 API Key **不得提交 git**。
- 记忆正文只在云端，运行时经 MCP 拉取。
