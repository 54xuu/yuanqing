---
name: yuanqing-upload-skill
description: >-
  Package a local skill directory and upload it to cloud yuanqing via MCP
  upload_skill, scoped by the account API key. Use when the user wants to sync
  a personal skill to the cloud catalog for Cursor/Trae/WorkBuddy. Triggers:
  上传 skill、同步 skill、upload_skill、yuanqing-upload-skill。
---

# 上传 Skill 到源清（upload_skill）

把本地 skill 目录打包上传到云端 yuanqing，按当前 MCP 的 `x-api-key` 归属到账号。

## 何时调用

- 用户说「把这个 skill 上传到源清」「同步 skill」
- 本地改完常用 skill，要推到云端供其它工具下载

## 目标路径（读取侧）

按**当前工具**定位要上传的本地目录（可配置；未知端先问用户）：

| 工具 | skill 根目录 |
|------|----------------|
| Cursor | `.cursor/skills/<name>/`（项目）或用户指定路径 |
| Trae Work | `.trae/skills/<name>/` |
| WorkBuddy | `%userprofile%/.workbuddy/skills/<name>/` |

## 怎么调用

1. 确认 skill `name`（目录名，kebab-case，匹配 `[a-z0-9-]`）。
2. 递归读取该目录下**全部文件**（至少含 `SKILL.md`）。
3. 相对路径相对 skill 根目录（如 `SKILL.md`、`scripts/run.sh`）。
4. 文本用 `encoding: "utf8"`；二进制用 `encoding: "base64"` 且 content 为 base64。
5. 从 `SKILL.md` frontmatter 取 `description`（可选）。
6. 调用：

```
upload_skill({
  name: "<skill-name>",
  description: "<from frontmatter or short summary>",
  files: [
    { path: "SKILL.md", content: "...", encoding: "utf8" },
    { path: "scripts/foo.sh", content: "<base64 or text>", encoding: "utf8" }
  ]
})
```

成功返回 `{ action: "created"|"updated", skill: { version, files, ... } }`。

## 注意

- 路径禁止 `..`、绝对路径、`~`（服务端会拒绝）。
- 同名会覆盖并 `version+1`。
- 需要已配置 yuanqing 远程 MCP（`/api/mcp` + `x-api-key`）。
