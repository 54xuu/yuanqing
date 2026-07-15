---
name: yuanqing-download-skill
description: >-
  Download skill packages from cloud yuanqing via list_skills/download_skill
  and write them into the current agent tool's skill directory. Use to sync
  personal skills into Cursor, Trae Work, or WorkBuddy. Triggers: 下载 skill、
  同步 skill、download_skill、yuanqing-download-skill。
---

# 从源清下载 Skill（download_skill）

从云端 yuanqing 拉取当前账号的 skill，写入**本机当前工具**的 skill 目录。

## 何时调用

- 用户说「从源清同步 skill」「下载我的常用 skill」
- 换机器 / 换工具后要恢复个人 skill 集

## 目标路径（写入侧，可配置）

| 工具 | 写入目录 |
|------|----------|
| Cursor | `.cursor/skills/<name>/SKILL.md` 及同包其它文件 |
| Trae Work | `.trae/skills/<name>/` |
| WorkBuddy | `%userprofile%/.workbuddy/<name>/` |

若当前工具不在表中或路径未知：**先问用户目标目录**，再写入。

## 怎么调用

1. 可选：`list_skills()` 列出 `{ name, description, version, file_count }`。
2. 对每个要同步的 `name`（或用户指定的列表）调用：

```
download_skill({ name: "<skill-name>" })
```

3. 返回 `{ skill: { name, description, version, files: [{ path, content, encoding }] } }`。
4. 在目标根目录创建 `<name>/`，按 `path` 写文件：
   - `encoding === "utf8"`：按 UTF-8 写文本
   - `encoding === "base64"`：解码后写二进制
5. **禁止**写出到 `path` 含 `..` 或绝对路径的条目（防御；服务端已校验）。

## 示例

在 Cursor 项目里同步全部个人 skill：

```
list_skills()
# 对每个 name:
download_skill({ name: "yuanqing-recall-memory" })
# 写入 .cursor/skills/yuanqing-recall-memory/...
```

## 注意

- 数据按 API Key 对应用户隔离；只能下载本账号上传的 skill。
- 写入前可提示将覆盖本地同名目录。
