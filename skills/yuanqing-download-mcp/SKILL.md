---
name: yuanqing-download-mcp
description: >-
  Download MCP server configs from cloud yuanqing via list_mcp/download_mcp
  and merge into the current tool's mcp.json. Replace ${YUANQING_API_KEY}
  with the local key. Triggers: 下载 mcp、同步 mcp 配置、download_mcp、
  yuanqing-download-mcp。
---

# 从源清下载 MCP 配置（download_mcp）

拉取当前账号的 MCP 配置，合并进本机当前工具的 MCP 配置文件。

## 何时调用

- 用户说「从源清同步 MCP」「下载 mcp 配置」
- 新环境要快速接上常用 MCP server

## 目标路径（写入侧，可配置）

| 工具 | MCP 配置文件 / 行为 |
|------|----------------|
| Cursor | `.cursor/mcp.json`（项目）或 `~/.cursor/mcp.json`（用户级） |
| Trae Work | **无法自动写入**；只能在界面手动配置。将合并后的 JSON **回复给用户**粘贴 |
| WorkBuddy | `%userprofile%/.workbuddy/mcp.json` |

Trae Work 时跳过写文件，直接输出如下结构（`config` 已注入本地 key）：

```json
{
  "mcpServers": {
    "<name>": { "url": "...", "headers": { "x-api-key": "yq_..." } }
  }
}
```

## 怎么调用

1. 可选：`list_mcp()` → `{ count, mcps: [{ name, description, updated_at }] }`。
2. 对每个要同步的 name：

```
download_mcp({ name: "yuanqing" })
```

返回 `{ mcp, config }`，其中 `config` 是应写入 `mcpServers[name]` 的对象。

3. 读取本地 mcp JSON（不存在则创建 `{ "mcpServers": {} }`）。
4. 将 `config` 合并到 `mcpServers[name]`（保留其它已有 server）。
5. 把字符串 `${YUANQING_API_KEY}`（以及 headers 里的同名占位）替换为**本机真实 API Key**（可从现有 yuanqing 配置、环境变量或询问用户获取）。**不要把云端占位符原样留给客户端。**
6. 写回本地文件（保持合法 JSON）；**Trae Work 改为把第 4–5 步结果以 JSON 回复用户**。

## 示例

```
list_mcp()
download_mcp({ name: "yuanqing" })
# 合并进 .cursor/mcp.json → mcpServers.yuanqing
# headers["x-api-key"] = 本地 yq_...
```

## 注意

- 按 API Key 用户隔离。
- 合并而非整文件覆盖，避免删掉其它 MCP。
- 密钥只存在本机，云端仅存占位符。
