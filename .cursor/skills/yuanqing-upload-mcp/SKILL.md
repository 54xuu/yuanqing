---
name: yuanqing-upload-mcp
description: >-
  Upload an MCP server config snippet to cloud yuanqing via upload_mcp,
  scoped by API key. Sensitive headers are replaced with ${YUANQING_API_KEY}
  before storage. Triggers: 上传 mcp、同步 mcp 配置、upload_mcp、yuanqing-upload-mcp。
---

# 上传 MCP 配置到源清（upload_mcp）

把单个 MCP server 配置片段存到云端 yuanqing，供其它工具下载合并。

## 何时调用

- 用户说「把这个 MCP 配置上传到源清」「同步 mcp」
- 本地调通某个 MCP 后，要集中备份/分发

## 本地配置读取路径（可配置）

| 工具 | 常见 MCP 配置位置 / 行为 |
|------|---------------------------|
| Cursor | 项目 `.cursor/mcp.json` 或用户级 `~/.cursor/mcp.json` |
| Trae Work | **无法自动读取**；请用户在界面查看或粘贴现有配置 JSON，再从中取出单个 server 上传 |
| WorkBuddy | `%userprofile%/.workbuddy/mcp.json` |

从本地 `mcpServers` 中取出**某一个** server 条目上传（不要整文件无差别上传密钥明文）。

## 怎么调用

```
upload_mcp({
  name: "yuanqing",
  description: "源清云端 MCP",
  config: {
    "url": "https://<域名>/api/mcp",
    "headers": {
      "x-api-key": "<本地 key，上传后会被替换为占位符>"
    }
  }
})
```

- `name`：`mcpServers` 里的键，匹配 `[a-z0-9-]`。
- `config`：该 server 的 JSON 对象（或 JSON 字符串）。
- 服务端会把 headers 中含 `api-key` / `authorization` / `token` / `secret` 的值替换为 `${YUANQING_API_KEY}`，**不要依赖明文密钥入库**。

成功：`{ action: "created"|"updated", mcp }`。

## 注意

- 上传前可先把本地 key 换成占位符再传，更安全。
- 同名覆盖更新。
