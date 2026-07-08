# Tasks

- [x] Task 1: 初始化 Next.js 工程与依赖
  - [x] SubTask 1.1: 在 /workspace 下创建 Next.js（App Router）+ TypeScript 项目骨架
  - [x] SubTask 1.2: 安装依赖（better-sqlite3、@modelcontextprotocol/sdk、uuid、react-markdown 等）
  - [x] SubTask 1.3: 配置 tsconfig、ESLint，确保 `npm run build` 通过

- [x] Task 2: 数据层与数据库初始化
  - [x] SubTask 2.1: 创建 `lib/db.ts`，初始化 SQLite，建立 Folder、Note、Note_fts(FTS5) 表
  - [x] SubTask 2.2: 实现首次启动时写入「自我介绍」「产品介绍」示例笔记
  - [x] SubTask 2.3: 封装笔记与文件夹的 DAO 函数（CRUD + 检索）

- [x] Task 3: REST API 路由
  - [x] SubTask 3.1: `app/api/folders` 路由（GET 列表、POST 创建）
  - [x] SubTask 3.2: `app/api/notes` 路由（GET 列表/检索、POST 创建）
  - [x] SubTask 3.3: `app/api/notes/[id]` 路由（GET、PUT、DELETE）
  - [x] SubTask 3.4: `app/api/search?q=` 路由（FTS5 检索）

- [x] Task 4: 前端编辑界面
  - [x] SubTask 4.1: `app/page.tsx` 三栏布局（文件夹树 / 笔记列表 / 编辑预览）
  - [x] SubTask 4.2: 文件夹树组件（创建、选中）
  - [x] SubTask 4.3: 笔记列表组件（按文件夹过滤、新建、删除）
  - [x] SubTask 4.4: Markdown 编辑/预览组件（保存触发 PUT）

- [x] Task 5: MCP Server 独立入口
  - [x] SubTask 5.1: 创建 `mcp-server/index.ts`，使用 `@modelcontextprotocol/sdk` 注册 `search_notes`、`get_note` 工具
  - [x] SubTask 5.2: 复用 `lib/db.ts` 的检索与读取函数
  - [x] SubTask 5.3: 提供 package.json 脚本 `npm run mcp` 以 stdio 方式启动

- [x] Task 6: 单元测试
  - [x] SubTask 6.1: 为 DAO 函数编写测试（CRUD、检索）
  - [x] SubTask 6.2: 为 MCP 工具调用编写测试（search_notes、get_note 返回结构正确）
  - [x] SubTask 6.3: 运行 `npm test` 全部通过

- [ ] Task 7: 端到端验证与清理
  - [ ] SubTask 7.1: 启动应用，用 agent-browser 截图验证文件夹/笔记显示与 CRUD 流程
  - [ ] SubTask 7.2: 清理测试代码与临时产物，保留示例数据
  - [ ] SubTask 7.3: 完善并提交 README.md 与代码

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 3
- Task 5 依赖 Task 2
- Task 6 依赖 Task 3、Task 5
- Task 7 依赖 Task 4、Task 5、Task 6
