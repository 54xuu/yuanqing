# 源清（YuanQing）

> 一个轻量级私有知识库，通过 MCP（Model Context Protocol）协议为 AI Agent 提供纯净、可信的个人上下文，让用户不必反复向 AI 介绍自己和自己的产品。

命名出处：《荀子·君道》「**源清则流清**」。寓意——只有个人知识源头保持纯净有序，AI 获取到的上下文才准确可信。

## 为什么需要源清

用户在与不同 AI / Agent 交互时，需要反复复制粘贴自我介绍、产品背景、项目资料等信息，存在三大痛点：

1. **重复喂料**——每次和不同 AI 对话都要重新粘贴自我介绍、产品背景
2. **信息孤岛**——笔记散落在多个应用，AI 无法统一访问
3. **检索困难**——长文档里找不到关键句，人工翻阅效率低

## 解决思路

把个人背景信息沉淀为结构化笔记，本地私有存储；对外暴露一个 MCP Server，让任意支持 MCP 的 Agent 能够自动检索并读取这些上下文，无需手动喂料。

- 用 **SQLite + FTS5** 提供毫秒级全文检索
- 用 **Folder / Note** 结构化组织个人上下文
- 暴露 MCP 工具 `search_notes(query)` 与 `get_note(id)`，Agent 主动按需拉取

## 使用场景（路演闭环）

预置「自我介绍」「产品介绍」两条笔记 → 在支持 MCP 的 Agent 中提问 → Agent 通过 `search_notes` 工具自动检索并读出对应内容，完成「AI 自动获取背景」的演示。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 / 全栈框架 | Next.js 16（App Router），单体应用同时承载 UI 与 API |
| 数据存储 | SQLite（better-sqlite3） |
| 全文检索 | SQLite FTS5（unicode61 分词） |
| MCP 实现 | 官方 MCP TypeScript SDK（`@modelcontextprotocol/sdk`），stdio 传输 |
| Markdown 预览 | react-markdown + remark-gfm |
| 测试 | Vitest |

## 项目结构

```
.
├── app/
│   ├── api/
│   │   ├── folders/route.ts          # 文件夹列表 / 创建
│   │   ├── folders/[id]/route.ts     # 文件夹 读取 / 更新 / 删除
│   │   ├── notes/route.ts            # 笔记列表 / 检索 / 创建
│   │   ├── notes/[id]/route.ts       # 笔记 读取 / 更新 / 删除
│   │   └── search/route.ts           # FTS5 关键词检索
│   ├── components/
│   │   ├── FolderTree.tsx            # 左栏：文件夹树
│   │   ├── NoteList.tsx              # 中栏：笔记列表 / 搜索结果
│   │   └── NoteEditor.tsx            # 右栏：Markdown 编辑 / 预览
│   ├── globals.css                   # 三栏布局与组件样式
│   ├── layout.tsx
│   └── page.tsx                      # 三栏主界面（客户端组件）
├── lib/
│   └── db.ts                         # SQLite 初始化、建表、种子数据、DAO、FTS5 检索
├── mcp-server/
│   └── index.ts                      # MCP Server 独立入口（stdio）
├── tests/
│   ├── setup.ts                      # 测试用临时 DB
│   ├── db.test.ts                    # DAO 单元测试
│   └── mcp.test.ts                   # MCP 工具返回结构测试
├── next.config.mjs
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## 数据模型

```
Folder
  - id: string (uuid)
  - name: string
  - parent_id: string | null
  - created_at: datetime

Note
  - id: string (uuid)
  - folder_id: string | null
  - title: string
  - content: string (markdown)
  - created_at: datetime
  - updated_at: datetime

Note_fts (FTS5 虚拟表)
  - note_id: string (UNINDEXED)
  - title: string
  - content: string
```

首次启动且数据库为空时，会自动写入 `源清` 文件夹及其下的「自我介绍」「产品介绍」两条示例笔记。

## 快速开始

### 环境要求

- Node.js 18+（推荐 20+）
- npm

### 安装与开发

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器，访问 http://localhost:3000
```

首次启动会在项目根目录生成 `yuanqing.db`（已被 `.gitignore` 忽略）并写入示例数据。

### 生产构建

```bash
npm run build      # 编译
npm run start      # 启动生产服务器
```

### 自定义数据库路径

通过环境变量 `YUANQING_DB_PATH` 指定 SQLite 文件位置：

```bash
YUANQING_DB_PATH=/data/my-notes.db npm run dev
```

## MCP 接入

源清自带一个 stdio 模式的 MCP Server，可在 Claude Desktop、Trae 等支持 MCP 的客户端中直接配置，无需额外认证。

### 启动 MCP Server

```bash
npm run mcp        # 等价于 tsx mcp-server/index.ts，以 stdio 方式运行
```

### 提供的 MCP 工具

| 工具 | 入参 | 返回 |
| --- | --- | --- |
| `search_notes` | `query: string`（关键词） | `{ count, results: [{ id, title, summary }] }` |
| `get_note` | `id: string`（笔记 uuid） | `{ note: { id, folder_id, title, content, created_at, updated_at } }`；未找到时返回 `{ error, id }` |

### 客户端配置示例（Claude Desktop）

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "yuanqing": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/yuanqing/mcp-server/index.ts"],
      "cwd": "/absolute/path/to/yuanqing"
    }
  }
}
```

配置完成后，在对话中提问，Agent 会自动调用 `search_notes` 获取候选笔记摘要，再调用 `get_note` 读取完整 Markdown，从而在对话中引用你的知识。

## REST API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/folders` | 列出全部文件夹 |
| POST | `/api/folders` | 创建文件夹，body `{ name, parent_id? }` |
| GET | `/api/folders/[id]` | 获取文件夹 |
| PUT | `/api/folders/[id]` | 更新文件夹名，body `{ name }` |
| DELETE | `/api/folders/[id]` | 删除文件夹 |
| GET | `/api/notes?folder_id=<id>` | 列出笔记（`folder_id=null` 为未分类；省略为全部） |
| GET | `/api/notes?q=<keyword>` | 关键词检索笔记 |
| POST | `/api/notes` | 创建笔记，body `{ folder_id?, title, content? }` |
| GET | `/api/notes/[id]` | 获取笔记完整内容 |
| PUT | `/api/notes/[id]` | 更新笔记，body `{ title?, content? }` |
| DELETE | `/api/notes/[id]` | 删除笔记 |
| GET | `/api/search?q=<keyword>` | FTS5 全文检索，返回 `{ results: [{ id, title, summary }] }` |

## 测试

```bash
npm test           # 运行 Vitest 单元测试（DAO + MCP 工具）
```

## 脚本一览

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run mcp` | 启动 MCP Server（stdio） |
| `npm test` | 运行单元测试 |
| `npm run lint` | 运行 lint |

## License

MIT
