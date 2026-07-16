# 源清 Skill 目录

本目录存放可被 **Cursor / OpenCode** 等 Agent 加载的 Skill。记忆与 Skill 目录真源是云端源清 MCP；Skill 只教 Agent **何时、如何**调用 MCP 工具。

## 保留的 Skill

| Skill | 作用 |
| --- | --- |
| `yuanqing-recall-memory` | 会话开始调用 `recall_memory` |
| `yuanqing-save-memory` | 沉淀偏好/踩坑时调用 `save_memory` |
| `yuanqing-bump-version` | 发版前 bump `package.json` 版本 |

## Skill 同步（无需专用 upload/download skill）

在已配置 yuanqing MCP 的前提下，直接对 Agent 说：

- **下载**：「帮我把 `yuanqing-recall-memory` 下载到 `~/.cursor/skills`」
- **上传**：「帮我把 `~/.cursor/skills/yuanqing-save-memory` 上传到云端」

Agent 会调用 MCP `download_skill` / `upload_skill`，并用自身文件工具读写本地目录。

### 各平台 Skill 目录

| 平台 | Skill 目录 |
| --- | --- |
| Cursor | `~/.cursor/skills/<name>/` 或项目 `.cursor/skills/<name>/` |
| OpenCode | `~/.config/opencode/skills/<name>/` |

### MCP 配置（手动，不入 git）

MCP 是一串 JSON，请在本机配置，**勿提交含 API Key 的文件**。

**Cursor**（`~/.cursor/mcp.json` 或项目 `.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "yuanqing": {
      "url": "https://你的域名/api/mcp",
      "headers": { "x-api-key": "yq_你的密钥" }
    }
  }
}
```

**OpenCode**（`~/.config/opencode/opencode.json` 的 `mcp` 键，见 `docs/templates/opencode.json.example`）。

## 记忆三层模型

| scope | 用途 | 路径 |
| --- | --- | --- |
| `global` | 与工具/项目无关的偏好 | `全局记忆/<标题>` |
| `tool` | 某 Agent 工具特有踩坑 | `tool=cursor\|opencode` → `工具记忆/<tool>/<标题>` |
| `project` | 单仓库约定 | `项目记忆/<项目>/<标题>` |

**只要在上述目录下的笔记都会被 `recall_memory` 召回**（含网页手动创建）。
