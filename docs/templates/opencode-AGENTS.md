# OpenCode 全局记忆指令（模板）

> 复制到 `~/.config/opencode/AGENTS.md`（**勿提交 git**）。

## 源清跨应用记忆

云端源清（yuanqing）是唯一记忆真源。本端标识：`tool=opencode`。

### 会话开始

在实质性工作前，若已配置 yuanqing MCP，调用：

```
recall_memory({ tool: "opencode", project: "<当前仓库目录名>" })
```

将返回的 global / tool / project 记忆纳入上下文并遵守。

### 沉淀记忆

用户表达持久偏好、发现工具踩坑或项目约定时，调用 `save_memory`（`source_app=opencode`），不要只写本地文件代替云端。

### Skill 目录

OpenCode Skill：`~/.config/opencode/skills/<name>/`

下载云端 skill：对 Agent 说「把 yuanqing-recall-memory 下载到 ~/.config/opencode/skills」。

### 安全

- 此文件与 `opencode.json` 中的 API Key **不得提交 git**。
- 记忆正文只在云端，运行时经 MCP 拉取。
