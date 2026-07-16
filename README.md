# 源清（YuanQing）

> 轻量级私有知识库，通过 MCP（Model Context Protocol）为 AI Agent 提供纯净、可信的个人上下文，让用户不必反复向 AI 介绍自己和自己的产品。

命名出处：《荀子·君道》「**源清则流清**」。寓意——只有个人知识源头保持纯净有序，AI 获取到的上下文才准确可信。

## 为什么需要源清

用户在与不同 AI / Agent 交互时，需要反复复制粘贴自我介绍、产品背景、项目资料等信息，存在三大痛点：

1. **重复喂料**——每次和不同 AI 对话都要重新粘贴自我介绍、产品背景
2. **信息孤岛**——笔记散落在多个应用，AI 无法统一访问
3. **检索困难**——长文档里找不到关键句，人工翻阅效率低

## 解决思路

把个人背景信息沉淀为结构化笔记，私有存储；对外暴露 MCP Server，让任意支持 MCP 的 Agent 能够自动检索并读取这些上下文，无需手动喂料。

- 用 **SQLite + FTS5** 提供毫秒级全文检索
- 用 **Folder / Note** 结构化组织个人上下文
- 用 **全局 / 工具 / 项目** 三层记忆目录，跨 Cursor、OpenCode 等客户端共享偏好与踩坑
- 暴露 MCP 工具供 Agent 检索、读写笔记与记忆，并支持 Skill 包同步

## 使用场景（路演闭环）

预置「自我介绍」「产品介绍」两条笔记 → 在支持 MCP 的 Agent 中提问 → Agent 通过 `search_notes` 工具自动检索并读出对应内容，完成「AI 自动获取背景」的演示。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 / 全栈框架 | Next.js 16（App Router），单体应用同时承载 UI 与 API |
| 后台 UI | Ant Design + ProLayout |
| 数据存储 | SQLite（better-sqlite3） |
| 全文检索 | SQLite FTS5（unicode61 分词） |
| MCP 实现 | 官方 MCP TypeScript SDK（`@modelcontextprotocol/sdk`），stdio + HTTP |
| Markdown 预览 | react-markdown + remark-gfm |
| 测试 | Vitest |
| 容器 | Docker（多阶段构建，standalone 输出） |

## 项目结构

```
.
├── app/
│   ├── (admin)/                 # 登录后后台（ProLayout 外壳）
│   │   ├── page.tsx             # 知识库三栏主界面
│   │   ├── memories/            # 记忆管理
│   │   ├── skills/              # Skill 管理
│   │   ├── api-keys/            # API 密钥
│   │   ├── users/               # 用户管理（admin）
│   │   └── settings/            # 个人设置（改密）
│   ├── api/                     # REST + MCP HTTP 端点
│   ├── components/              # 知识库组件（FolderTree / NoteList / NoteEditor）
│   ├── login/                   # 登录页
│   └── providers/               # Ant Design 全局配置
├── lib/                         # DB、鉴权、会话、菜单权限等
├── mcp-server/index.ts          # MCP Server 独立入口（stdio）
├── skills/                      # 可上传至云端的 Skill 包模板
├── docs/templates/              # Cursor / OpenCode 配置示例
├── tests/                       # 单元测试 + MCP 端到端测试
├── Dockerfile
└── docker-compose.yml
```

## 数据模型

```
Folder
  - id, name, parent_id, created_at

Note
  - id, folder_id, title, content (markdown)
  - created_at, updated_at, sort_order
  - mem_scope: 'global' | 'tool' | 'project' | null   # 跨应用记忆层；null=普通笔记
  - mem_tool / mem_project / source_app / mem_tags    # 记忆元数据（可空）

Note_fts (FTS5 虚拟表)
  - note_id (UNINDEXED), title, content

User / ApiKey / SkillPackage ...（用户、密钥、Skill 包等）
```

首次启动且数据库为空时，会自动写入示例文件夹与「自我介绍」「产品介绍」笔记，并创建管理员账号（密码见下方环境变量）。

## 快速开始

### 环境要求

- Node.js 20+（推荐 22 LTS）
- npm

### 安装与开发

```bash
git clone <your-repo-url>
cd yuanqing
npm install
npm run dev
```

浏览器访问 `http://localhost:3000`，首次启动会在项目根目录生成 `yuanqing.db`（已被 `.gitignore` 忽略）。

> **WSL 用户**：请在 WSL 内安装 Linux 版 Node.js（`which node` 应为 `/usr/bin/node`），不要用 Windows 侧 node 访问 UNC 路径，否则会出现找不到 `app/` 等错误。

### 生产构建

```bash
npm run build
npm run start
```

### Docker（推荐）

```bash
# 复制环境变量模板并编辑（勿提交 .env）
cp .env.example .env

# 本地 compose 启动
docker compose up -d --build
```

`docker-compose.yml` 将 SQLite 持久化到命名卷 `/data`。

## 环境变量

| 变量 | 作用 | 是否必填 |
| --- | --- | --- |
| `YUANQING_SESSION_SECRET` | 登录会话 Cookie 的 HMAC 签名密钥（≥16 字符） | **生产必填** |
| `YUANQING_ADMIN_PASSWORD` | 首次建库时 admin 账号密码 | 推荐（不设则用内置默认值，**上线务必修改**） |
| `YUANQING_DB_PATH` | SQLite 文件路径；默认 `./yuanqing.db` | 推荐 |
| `YUANQING_COOKIE_SECURE` | 设为 `false` 时 HTTP 部署也写入 Cookie（无 Secure 标志） | 内网 HTTP 部署时需要 |
| `PORT` | 监听端口；默认 3000 | 可选 |

示例 `.env`（**勿将真实密钥提交到 Git**）：

```bash
YUANQING_SESSION_SECRET=请替换为随机长字符串
YUANQING_ADMIN_PASSWORD=请替换为强密码
YUANQING_DB_PATH=/data/yuanqing.db
YUANQING_COOKIE_SECURE=false   # 仅在内网 HTTP 场景
```

## 后台功能（v2.3）

登录后侧边栏：

| 菜单 | 说明 |
| --- | --- |
| 知识库 | 文件夹 + 笔记三栏编辑，FTS 搜索 |
| 记忆管理 | 查看 `全局记忆 / 工具记忆 / 项目记忆` 下的笔记 |
| Skill 管理 | 列表、ZIP 下载、复制链接、查看文件 |
| API 密钥 | 创建 / 重命名 / 复制（供 MCP HTTP 鉴权） |
| 用户管理 | admin 创建用户、分配密钥 |
| 个人设置 | 修改密码 |

## MCP 接入

源清同时提供 **stdio** 与 **HTTP（Streamable HTTP）** 两种传输：

| 模式 | 启动方式 | 鉴权 | 适用场景 |
| --- | --- | --- | --- |
| stdio | `npm run mcp` | 无 | Agent 与源清在同一台机器 |
| HTTP | `npm run start` → `/api/mcp` | API Key | 源清部署在服务器，远程 Agent 访问 |

### MCP 工具（节选）

| 工具 | 说明 |
| --- | --- |
| `search_notes` / `get_note` / `upsert_note` / `get_note_by_path` | 普通笔记 CRUD 与检索 |
| `recall_memory` / `save_memory` | 跨应用三层记忆召回与写入 |
| `list_skills` / `download_skill` / `upload_skill` / `delete_skill` | Skill 包管理 |

> 跨 Cursor / OpenCode 的持久记忆请用 `save_memory` + `recall_memory`；普通笔记用 `upsert_note`。

配置模板见 [`docs/templates/`](docs/templates/)（含 `cursor-mcp.json.example`、`opencode.json.example`、`opencode-AGENTS.md`）。

### 客户端配置示例（stdio，本地）

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

### 远程 HTTP 配置示例

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

也可使用 `Authorization: Bearer yq_你的APIKey`。API Key 在后台「API 密钥」页面创建。

## 部署到服务器

### 方式一：Docker 镜像

```bash
# 构建（华为 SWR 等仓库需 DOCKER_BUILDKIT=0 以兼容 v2 manifest）
DOCKER_BUILDKIT=0 docker build -t yuanqing:v2.3 .

# 推送到私有仓库（替换为你的 registry 地址）
docker tag yuanqing:v2.3 <registry>/yuanqing:v2.3
docker push <registry>/yuanqing:v2.3
```

容器启动示例：

```bash
docker run -d \
  -p 3000:3000 \
  -e YUANQING_SESSION_SECRET='随机长字符串' \
  -e YUANQING_ADMIN_PASSWORD='强密码' \
  -e YUANQING_DB_PATH=/data/yuanqing.db \
  -e YUANQING_COOKIE_SECURE=false \
  -v yuanqing-data:/data \
  yuanqing:v2.3
```

### 方式二：Node 直接运行

```bash
npm ci && npm run build
YUANQING_SESSION_SECRET='...' YUANQING_DB_PATH=/data/yuanqing.db npm run start
```

### 获取 API Key（REST）

```bash
# 1) 登录（密码为你在 YUANQING_ADMIN_PASSWORD 中设置的值）
curl -c cookies.txt -X POST https://yuanqing.example.com/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"<你的密码>"}'

# 2) 创建 API Key（完整 key 仅返回一次）
curl -b cookies.txt -X POST https://yuanqing.example.com/api/api-keys \
  -H 'content-type: application/json' \
  -d '{"name":"cursor-opencode"}'
```

## REST API（节选）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/folders` | 文件夹列表 / 创建 |
| GET/POST | `/api/notes` | 笔记列表 / 创建 |
| GET | `/api/search?q=` | FTS5 全文检索 |
| GET | `/api/memories` | 记忆列表 |
| GET | `/api/skills` | Skill 列表 |
| GET | `/api/skills/[name]/download` | Skill ZIP 下载 |
| GET/POST | `/api/api-keys` | API 密钥管理 |
| POST | `/api/auth/login` | 登录（Set-Cookie） |
| GET | `/api/auth/me` | 当前用户 |

## 测试

```bash
npm test                  # Vitest 单元测试
npm run test:mcp-client   # 端到端 MCP 协议测试（独立临时 DB）
```

## 脚本一览

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 生产服务器 |
| `npm run mcp` | MCP Server（stdio） |
| `npm test` | 单元测试 |
| `npm run test:mcp-client` | MCP 端到端测试 |

## License

MIT
