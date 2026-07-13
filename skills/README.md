# yuanqing Skills（跨应用记忆与发布）

本目录存放可被 **Cursor / Trae** 等 Agent 加载的 Skill。记忆真源仍是云端源清 MCP；Skill 只教 Agent **何时、如何**调用 MCP 工具。

## 前置：配置云端 MCP

两端都连同一实例（示例）：

```json
{
  "mcpServers": {
    "yuanqing": {
      "url": "https://<你的域名>/api/mcp",
      "headers": {
        "x-api-key": "yq_..."
      }
    }
  }
}
```

确认 `tools/list` 含：`recall_memory`、`save_memory`（以及旧工具 `search_notes` 等）。若只有 4 个旧工具，说明云端镜像未含记忆功能，需升级后再用。

## Skill 一览

| 目录 | 名称 | 何时用 |
|------|------|--------|
| [`yuanqing-recall-memory/`](yuanqing-recall-memory/) | 召回记忆 | 会话开始、换项目、需要遵守已有偏好/踩坑 |
| [`yuanqing-save-memory/`](yuanqing-save-memory/) | 沉淀/更新记忆 | 用户说「记住这个」、发现可复用约定、要改已有记忆 |
| [`yuanqing-bump-version/`](yuanqing-bump-version/) | 发布前改版本号 | 打 Docker/SWR tag、升 Sealos 之前 |

## 在各工具里怎么挂载

### Cursor

- 项目级：复制或软链到 `.cursor/skills/<name>/SKILL.md`
- 或在对话里 `@` 引用本目录下的 `SKILL.md`
- 记忆规约规则已在 `.cursor/rules/memory.mdc`（alwaysApply）

### Trae

- 复制到 `.trae/skills/<name>/SKILL.md`（与现有 `huawei-swr-push` 同级）
- 记忆规约见 `.trae/rules/memory.md`

### 其它支持 MCP 的应用

1. 配好 yuanqing 远程 MCP（同上）
2. 把对应 Skill 内容放进该应用的 rules / skills / system prompt
3. 会话开始调 `recall_memory`；要沉淀或修改时调 `save_memory`（同 title 即覆盖更新）

## 三层记忆速查

| scope | 含义 | 必填额外字段 | 路径 |
|-------|------|--------------|------|
| `global` | 与工具/项目无关的偏好 | — | `全局记忆/<标题>` |
| `tool` | 某 Agent 工具特有踩坑 | `tool=cursor\|trae\|...` | `工具记忆/<tool>/<标题>` |
| `project` | 单仓约定 | `project=<仓库名>` | `项目记忆/<项目>/<标题>` |

**修改记忆**：对同一 `scope`（及 tool/project）使用**相同 `title`** 再调一次 `save_memory`，内容会覆盖；也可在 Web UI 打开对应文件夹直接编辑笔记。

**不要用** `upsert_note` 写跨端共享记忆（缺少作用域元数据，`recall_memory` 召不回）。
