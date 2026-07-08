# 源清（YuanQing）MVP 知识库 Spec

## Why
用户与不同 AI/Agent 交互时需要反复粘贴自我介绍、产品背景等信息，存在检索难、信息孤岛、重复表达三大痛点。源清通过本地私有的结构化笔记沉淀个人上下文，并对外暴露 MCP Server，让任意支持 MCP 的 Agent 自动检索读取，免去手动喂料。

## What Changes
- 新增 Next.js（App Router）单体应用，承载 UI 与 API
- 新增 SQLite 数据层，包含 Folder、Note 两张表，Note 使用 FTS5 建立全文索引
- 新增笔记 CRUD 与文件夹树状管理 API
- 新增 MCP Server 独立入口，暴露 `search_notes(query)` 与 `get_note(id)` 工具
- 新增 Web 编辑界面：左侧文件夹树、中间笔记列表、右侧 Markdown 编辑/预览
- 新增预置示例笔记（自我介绍、产品介绍）用于路演
- 完善 README.md 说明文档

## Impact
- Affected specs: 无（首次立项）
- Affected code: 全新工程，根目录建立 Next.js 项目结构，新增 `app/`、`lib/`、`mcp-server/` 等模块

## ADDED Requirements

### Requirement: 笔记 CRUD
系统 SHALL 支持新建、读取、编辑、删除 Markdown 笔记，每条笔记含 `id`、`folder_id`、`title`、`content`、`created_at`、`updated_at`。

#### Scenario: 创建笔记
- **WHEN** 用户通过 API 或界面提交标题与正文
- **THEN** 系统生成 uuid，写入 SQLite（含 FTS5 索引），返回新笔记对象并附带时间戳

#### Scenario: 删除笔记
- **WHEN** 用户请求删除指定 id 的笔记
- **THEN** 系统从数据库移除该笔记及对应 FTS 索引，并返回成功

### Requirement: 文件夹管理
系统 SHALL 支持创建文件夹并形成树状层级，文件夹含 `id`、`name`、`parent_id`。

#### Scenario: 树状展示
- **WHEN** 用户请求文件夹列表
- **THEN** 系统返回带 `parent_id` 的文件夹数组，前端可据此渲染层级树

### Requirement: MCP Server
系统 SHALL 暴露一个独立 MCP Server，基于 `@modelcontextprotocol/sdk`，至少提供 `search_notes(query: string)` 与 `get_note(id: string)` 工具。

#### Scenario: search_notes 调用
- **WHEN** Agent 通过 MCP 调用 `search_notes`，传入关键词
- **THEN** 系统基于 FTS5 检索，返回匹配笔记列表（id、title、摘要片段）

#### Scenario: get_note 调用
- **WHEN** Agent 通过 MCP 调用 `get_note`，传入笔记 id
- **THEN** 系统返回该笔记的完整 markdown 内容

### Requirement: 前端编辑界面
系统 SHALL 提供 Web 界面：左侧文件夹树、中间笔记列表、右侧 Markdown 编辑/预览。

#### Scenario: 编辑并保存
- **WHEN** 用户在右侧编辑器修改正文并点击保存
- **THEN** 系统更新笔记 `content` 与 `updated_at`，并在中间列表反映最新标题

### Requirement: 全文检索
系统 SHALL 通过 SQLite FTS5 提供关键词检索能力，UI 与 MCP 共用同一检索函数。

#### Scenario: 关键词命中
- **WHEN** 检索关键词出现在笔记标题或正文
- **THEN** 该笔记被返回，并附带摘要片段

### Requirement: 预置示例数据
系统 SHALL 内置「自我介绍」「产品介绍」两条笔记，用于路演演示。

#### Scenario: 首次启动
- **WHEN** 数据库为空且应用首次启动
- **THEN** 系统自动写入两条示例笔记

### Requirement: README 文档
项目根目录 SHALL 包含一份 README.md，说明项目定位、技术栈、启动方式、MCP 接入示例。

#### Scenario: 文档可读
- **WHEN** 访问者打开仓库
- **THEN** 可在 README 中了解如何启动应用与配置 MCP 客户端
