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
- 暴露 MCP 工具 `search_notes(query)`、`get_note(id)` 与 `upsert_note(path, content)`，Agent 可按需检索、读取，也可直接写回笔记

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
│   ├── mcp.test.ts                   # MCP 工具返回结构测试
│   └── mcp-client.ts                 # 端到端 MCP 客户端测试（拉起 server，走协议验证所有工具）
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

- Node.js 18+（推荐 20+，开发用 22 LTS 已验证）
- npm

### 开发环境准备（WSL Ubuntu 用户必读）

如果你的项目放在 WSL 文件系统里（例如 `~/devbox/yuanqing`），**必须在 WSL 里安装 Linux 版 Node.js**，不能直接用 Windows 的 Node。否则 `npm run dev` 会报：

```
'\\wsl.localhost\Ubuntu-22.04\home\xujian\devbox\yuanqing'
用作为当前目录的以上路径启动了 CMD.EXE。
UNC 路径不受支持。默认值设为 Windows 目录。
Error: > Couldn't find any `pages` or `app` directory.
```

原因是 Windows 版 node.exe 不支持 UNC 路径作为当前目录，会自动回退到 `C:\Windows`，导致找不到 `app/` 目录。

**正确做法（在 WSL 里执行）**：

```bash
# 1. 安装 Node.js 22 LTS（NodeSource 仓库）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 验证（应显示 v22.x 和 10.x）
node --version
npm --version

# 3. 确认用的是 Linux 版而非 Windows 版
which node   # 应为 /usr/bin/node，而不是 /mnt/d/... 或 /mnt/c/...
which npm    # 应为 /usr/bin/npm，而不是 /mnt/d/... 或 /mnt/c/...
```

> 如果你之前装过 nvm，也可以用 `nvm install 22 && nvm use 22` 替代上面的 NodeSource 方式。

### 安装与开发

```bash
# 在 WSL 里执行
cd ~/devbox/yuanqing
npm install        # 首次需要安装依赖
npm run dev        # 启动开发服务器
```

### 访问开发服务器

**WSL 里启动后，在 Windows 浏览器直接访问** `http://localhost:3000` 即可——WSL2 会自动把 localhost 端口转发到 Windows 主机，无需额外配置。

> 如果在 Windows PowerShell 里访问 WSL 项目（不推荐），需要先用 `subst Y: \\wsl.localhost\Ubuntu-22.04\home\xujian\devbox\yuanqing` 映射盘符，再 `cd Y:\ && node node_modules\next\dist\bin\next dev`。但这种方式会遇到 better-sqlite3 junction point 创建失败的问题（Turbopack 限制），建议优先用 WSL 原生 Node。

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
| `upsert_note` | `path: string`（如 `目录A/笔记B`，最后一段为笔记标题，前面段为文件夹层级，不存在则自动创建）、`content: string`（新完整 Markdown 内容） | `{ action: "created" \| "updated", note }`；路径非法时返回 `{ error, path }`。同名同目录笔记存在则覆盖内容，不存在则新增 |

> `upsert_note` 是写操作：Agent 不仅能检索/读取你的知识，还能在对话中把新产生的结论、会议纪要、待办等直接写回知识库（按 `目录/笔记` 路径自动建文件夹与笔记）。

### 两种传输模式

源清同时提供两种 MCP 传输方式，对应不同的部署/使用场景：

| 模式 | 启动方式 | 鉴权 | 适用场景 |
| --- | --- | --- | --- |
| **stdio** | `npm run mcp` | 无 | Agent 与源清运行在**同一台机器**（如本地 Claude Desktop / 本地 IDE） |
| **HTTP (Streamable HTTP)** | `npm run start` 后访问 `/api/mcp` | API Key（`x-api-key` 或 `Authorization: Bearer`） | 源清部署在**服务器**，远程 Agent（如 Trae Work / 云端 Agent）通过网络访问 |

### 客户端配置示例（stdio，本地）

适用于 Claude Desktop、Trae IDE 等本地客户端，在配置文件中加入：

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

配置完成后，在对话中提问，Agent 会自动调用 `search_notes` 获取候选笔记摘要，再调用 `get_note` 读取完整 Markdown，从而在对话中引用你的知识；需要记录新内容时调用 `upsert_note` 写回。

## 部署到服务器后的 Agent 配置

当代码部署到服务器后，远程 Agent（如 **Trae Work**、云端 Agent、团队共享的 IDE）无法通过 stdio 拉起本地进程，需要走 **HTTP 传输**：Agent 通过 `https://<你的域名>/api/mcp` 访问源清，并用 **API Key** 鉴权。完整流程如下。

### 1. 部署服务

在服务器上构建并启动生产服务（假设域名 `yuanqing.example.com`，已用反向代理终止 TLS 并转发到 3000 端口）：

```bash
# 安装依赖并构建
npm ci
npm run build

# 启动生产服务（默认监听 3000）
# 生产环境务必显式设置会话密钥与数据库路径
YUANQING_SESSION_SECRET=<一段随机长字符串> \
YUANQING_DB_PATH=/data/yuanqing.db \
npm run start
```

需要的环境变量：

| 变量 | 作用 | 是否必填 |
| --- | --- | --- |
| `YUANQING_SESSION_SECRET` | 登录会话 Cookie 的 HMAC 签名密钥；不设则进程级随机（重启失效，**生产必须显式设置**） | 生产必填 |
| `YUANQING_DB_PATH` | SQLite 文件位置；默认 `./yuanqing.db` | 推荐 |
| `PORT` | 监听端口；默认 3000 | 可选 |

服务起来后，首次访问会自动建表并写入示例数据与管理员账号 `admin` / `Admin@123`（**上线后请立刻在后台修改密码**）。

### 2. 生成 API Key

Agent 调用 `/api/mcp` 需要一个有效的 API Key。两种获取方式：

- **后台界面**：浏览器访问 `https://yuanqing.example.com/login`，用 `admin` / `Admin@123` 登录 → 进入 `/admin` → 「我的 API 密钥」→「创建密钥」→ 复制形如 `yq_xxxxxxxx...` 的完整 Key。
- **REST API**（适合自动化）：
  ```bash
  # 1) 登录拿到会话 Cookie
  curl -c cookies.txt -X POST https://yuanqing.example.com/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"username":"admin","password":"Admin@123"}'

  # 2) 创建一个 API Key（返回完整 key，仅此一次可见）
  curl -b cookies.txt -X POST https://yuanqing.example.com/api/api-keys \
    -H 'content-type: application/json' \
    -d '{"name":"trae-work"}'
  ```

### 3. 配置 Trae Work / 远程 Agent（HTTP 模式）

拿到 API Key 后，在 Agent 的 MCP 配置中添加一个 **Streamable HTTP** 类型的 server，把 Key 放进请求头。Trae Work / Trae IDE 的 MCP 配置（`mcp.json` 或设置面板的「MCP」入口）示例如下：

```json
{
  "mcpServers": {
    "yuanqing": {
      "url": "https://yuanqing.example.com/api/mcp",
      "type": "http",
      "headers": {
        "x-api-key": "yq_你的APIKey"
      }
    }
  }
}
```

> 部分客户端（如 Claude Desktop 远程、旧版 Trae）字段名可能是 `transport`、`serverUrl` 或 `command: "http"`，但核心都是：**URL 指向 `/api/mcp`，请求头带 `x-api-key`**。若客户端不支持自定义请求头，可改用 `Authorization: Bearer yq_你的APIKey`，源清两种方式都接受。

配置完成后，在 Trae Work 的对话中即可让 Agent：
- `search_notes` 检索知识库
- `get_note` 读取某条笔记全文
- `upsert_note` 把对话中产生的新结论/纪要按 `目录/笔记` 路径写回知识库

### 4. 同机部署也可用 stdio（可选）

如果 Agent 与源清在同一台服务器（例如服务器上同时跑 Trae IDE），也可以不经过 HTTP、直接用 stdio，配置同上文「客户端配置示例（stdio，本地）」，把路径换成服务器上的绝对路径即可。stdio 模式不需要 API Key。

### 5. 端到端验证（MCP 客户端测试）

项目自带一个端到端 MCP 客户端测试脚本，会真的拉起 `mcp-server/index.ts` 并通过 MCP 协议逐一验证 3 个工具（`search_notes` / `get_note` / `upsert_note`，含创建、更新、嵌套路径、错误分支）：

```bash
npm run test:mcp-client      # 等价于 tsx tests/mcp-client.ts
```

脚本使用独立的临时数据库，不会污染线上的 `yuanqing.db`。要验证部署后的 HTTP 端点，可参考 [mcp-client.ts](file:///workspace/tests/mcp-client.ts) 中的客户端用法，把 `StdioClientTransport` 换成 `StreamableHTTPClientTransport(new URL('https://yuanqing.example.com/api/mcp'), { requestInit: { headers: { 'x-api-key': 'yq_...' } } })` 即可。

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
npm test                  # 运行 Vitest 单元测试（DAO + MCP 工具 handler）
npm run test:mcp-client   # 端到端：拉起 MCP server，用 MCP 客户端走协议验证所有工具
```

## 脚本一览

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run mcp` | 启动 MCP Server（stdio） |
| `npm test` | 运行单元测试 |
| `npm run test:mcp-client` | 端到端 MCP 客户端测试 |
| `npm run lint` | 运行 lint |

## License

MIT
