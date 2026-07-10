# 用户管理 + MCP 鉴权 实施计划

## 概述（Summary）

为「源清 YuanQing」知识库增加后台用户管理与 MCP api_key 鉴权，使其可安全对外访问：
1. 内置管理员账号 `admin` / `Admin@123`，支持登录会话。
2. 整个应用（知识库界面 + 后台）需登录后访问；MCP 通过 HTTP 暴露并用 `api_key` 鉴权。
3. 每个后台账号可管理自己的 api_key；管理员额外可管理用户与为任意用户创建/删除 api_key。

范围：仅实现功能并在本地验证（编译通过 + agent-browser 流程 + MCP 鉴权）。云端部署不在本次范围。

---

## 当前状态分析（Current State Analysis）

- 技术栈：Next.js 16 (App Router) + React 19 + TypeScript + better-sqlite3（原生 SQL，无 ORM）+ 官方 `@modelcontextprotocol/sdk` ^1.29。
- 现有数据模型：`Folder`、`Note`、`Note_fts`（FTS5），全部 DAO 集中在 [lib/db.ts](file:///workspace/lib/db.ts)。
- 现有 API：`/api/folders`、`/api/notes`、`/api/search`，均为 Next.js Route Handler，`export const dynamic = 'force-dynamic'`，无任何鉴权。
- 现有 MCP：[mcp-server/index.ts](file:///workspace/mcp-server/index.ts) 仅 stdio 传输，2 个工具 `search_notes` / `get_note`，handler 已抽为可测试纯函数并 export。
- 鉴权现状：**零认证基线**——无 middleware、无 User 表、无 session、无 api_key、无密码哈希。
- 已确认 SDK 能力：
  - `WebStandardStreamableHTTPServerTransport`（`@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`）接收 Web 标准 `Request`、返回 `Response`，**stateless 模式**用 `sessionIdGenerator: undefined`，每个请求需新建 transport 实例（源码注释明确：stateless transport 不可跨请求复用）。
  - MCP 客户端 `StreamableHTTPClientTransport`（`client/streamableHttp.js`）支持 `requestInit.headers` 自定义请求头 → 可传 `x-api-key`。
  - 客户端 `Client` 导出自 `client/index.js`。

---

## 方案与关键决策（Assumptions & Decisions）

1. **MCP 传输**：新增 HTTP Streamable HTTP 端点 `/api/mcp`（stateless，每请求新建 transport+server），保留原有 stdio 入口供本地客户端使用（非破坏性）。stdio 与 HTTP 复用同一个 `createMcpServer()` 工厂。
2. **会话鉴权**：HMAC-SHA256 签名的 httpOnly Cookie（`yq_session`），用 WebCrypto（`globalThis.crypto.subtle`）实现，**edge 运行时可用**，供 `middleware.ts` 在边缘验证签名（不触碰 DB）。
3. **密码哈希**：Node 内置 `crypto.scrypt`（`salt:hash`），不引入新依赖（避免再装 bcrypt 原生模块）。仅在 Node 运行时的 Route Handler 中使用。
4. **模块分层（避免 edge/node 冲突）**：
   - `lib/session.ts`（edge 安全，仅 WebCrypto，无 node 导入）→ 被 `middleware.ts` 与 Route Handler 共用。
   - `lib/password.ts`（`node:crypto`）→ 仅被 Node Route Handler 与 `lib/db.ts` 使用。
   - `lib/auth.ts`（组合 session + db，提供 `getCurrentUser`）→ 仅 Node Route Handler 使用。
   - `lib/db.ts` 新增 User/ApiKey 表与 DAO。
   - **`middleware.ts` 只允许 import `lib/session.ts`**，绝不引入 db/password。
5. **api_key 存储**：MVP 明文存库（`key TEXT UNIQUE`），列表接口返回完整 key（已在登录态后）。便于 agent-browser 抓取使用；后续可升级为哈希（不在本次范围）。
6. **访问控制**：整个应用需登录。`middleware.ts` 放行 `/login`、`/api/auth/login`、`/api/mcp`、静态资源；其余路径无有效会话则：API 返回 401 JSON、页面 302 跳转 `/login`。
7. **会话密钥**：读 `process.env.YUANQING_SESSION_SECRET`；未设置则进程级随机（重启失效，本地验证可接受；生产应显式设置）。
8. **admin 登录后落地页**：登录成功后 admin 跳转 `/admin`，普通用户跳转 `/`。

---

## 拟定变更（Proposed Changes）

### A. 数据层 — [lib/db.ts](file:///workspace/lib/db.ts)（编辑）

- `initSchema` 新增两表：
  ```sql
  CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,          -- scrypt: saltHex:hashHex
    role TEXT NOT NULL DEFAULT 'user',    -- 'admin' | 'user'
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ApiKey (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_apikey_user ON ApiKey(user_id);
  CREATE INDEX IF NOT EXISTS idx_apikey_key ON ApiKey(key);
  ```
- 新增接口 `User`、`ApiKey`，新增 `seedAdmin(db)`（若不存在 role='admin' 用户则用 `hashPassword('Admin@123')` 创建 `admin`），在 `getDb()` 首次初始化时调用（与 `seedIfEmpty` 并列）。
- 新增 DAO：`listUsers`、`getUserById`、`getUserByUsername`、`createUser(username, password, role)`、`deleteUser(id)`、`createApiKey(userId, name)`（key 形如 `yq_` + `crypto.randomUUID()` 去横线）、`listApiKeysByUser(userId)`、`listAllApiKeys()`（admin 用，含 username）、`getApiKeyByKey(key)`、`deleteApiKey(id)`、`deleteApiKeysByUser(userId)`。
- 引入 `import { hashPassword } from './password'`（node 链，与 db 一致）。

### B. 会话与密码工具（新增）

- **[lib/session.ts](file:///workspace/lib/session.ts)**（edge 安全）：
  - `SESSION_SECRET`（env 或进程级随机，模块加载时定）。
  - `signSession(userId: string): Promise<string>` → `${userId}.${base64url(hmac)}`。
  - `verifySession(token: string | undefined): Promise<string | null>` → 返回 userId 或 null。
  - `SESSION_COOKIE = 'yq_session'`；`cookieOptions`（httpOnly, sameSite=lax, path=/, secure = NODE_ENV==='production'）。
  - 全部基于 `globalThis.crypto.subtle`（HMAC-SHA256）。
- **[lib/password.ts](file:///workspace/lib/password.ts)**（node）：
  - `hashPassword(plain): string` → `saltHex:hashHex`（scryptSync, N=16384, r=8, p=1, len=64）。
  - `verifyPassword(plain, stored): boolean`（拆 salt，timingSafeEqual）。
- **[lib/auth.ts](file:///workspace/lib/auth.ts)**（node，Route Handler 用）：
  - `getCurrentUser(request): Promise<User | null>`：读 `yq_session` cookie → `verifySession` → `getUserById`。
  - `requireUser(request)` / `requireAdmin(request)`：返回 `{ user }` 或 `{ error: Response(401/403) }`，供各路由复用。

### C. MCP 服务端重构 — [mcp-server/index.ts](file:///workspace/mcp-server/index.ts)（编辑）

- 抽出并导出 `createMcpServer(): McpServer`（注册 `search_notes`/`get_note`，复用现有 handler）。
- 保留 `handleSearchNotes` / `handleGetNote` 导出（现有测试 [tests/mcp.test.ts](file:///workspace/tests/mcp.test.ts) 依赖）。
- stdio 启动块改为 `createMcpServer().connect(transport)`，`VITEST` 守卫不变。

### D. 中间件 — [middleware.ts](file:///workspace/middleware.ts)（新增，项目根）

- 仅 import `lib/session.ts`（edge 安全）。
- 读 `yq_session` cookie → `verifySession`：有效则 `NextResponse.next()`。
- 无效：`/api/*` 返回 `401 JSON { error: 'unauthorized' }`；其余 302 → `/login`。
- `config.matcher` 放行：`/login`、`/api/auth/login`、`/api/mcp`、`_next/static`、`_next/image`、`favicon.ico`。

### E. 认证 API（新增）

- **[app/api/auth/login/route.ts](file:///workspace/app/api/auth/login/route.ts)**：`POST` — 校验 username/password（`getUserByUsername` + `verifyPassword`），成功 set `yq_session` cookie（`signSession(user.id)`），返回 `{ user }`；失败 401。
- **[app/api/auth/logout/route.ts](file:///workspace/app/api/auth/logout/route.ts)**：`POST` — 清除 cookie，返回 `{ ok: true }`。
- **[app/api/auth/me/route.ts](file:///workspace/app/api/auth/me/route.ts)**：`GET` — 返回当前 `{ user }`（无密码字段）。

### F. 用户管理 API（admin only，新增）

- **[app/api/admin/users/route.ts](file:///workspace/app/api/admin/users/route.ts)**：`GET` 列出所有用户；`POST` 创建用户（body: username, password, 可选 role；校验非空、username 唯一；`createUser`）。
- **[app/api/admin/users/[id]/route.ts](file:///workspace/app/api/admin/users/[id]/route.ts)**：`DELETE` 删除用户（禁止删除自己；级联删其 ApiKey）。
- **[app/api/admin/users/[id]/api-keys/route.ts](file:///workspace/app/api/admin/users/[id]/api-keys/route.ts)**：`GET` 列出该用户 key；`POST` 为该用户创建 key（admin 可为任意用户建 key，便于验收）。
- 以上路由均 `requireAdmin`，失败 403。

### G. 自服务 API Key API（任意登录用户，新增）

- **[app/api/api-keys/route.ts](file:///workspace/app/api/api-keys/route.ts)**：`GET` 列出当前用户自己的 key；`POST` 创建自己的 key。
- **[app/api/api-keys/[id]/route.ts](file:///workspace/app/api/api-keys/[id]/route.ts)**：`DELETE` 删除 key（仅 owner 或 admin）。

### H. MCP HTTP 端点 — [app/api/mcp/route.ts](file:///workspace/app/api/mcp/route.ts)（新增）

- `export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';`
- 提取 api_key：优先 `x-api-key` 头，回退 `Authorization: Bearer <key>`。
- `getApiKeyByKey(key)` 校验：无/错误 → 返回 `401` JSON-RPC error `{ code:-32001, message:'unauthorized' }`。
- 通过后：`new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })` → `createMcpServer()` → `await server.connect(transport)` → `return transport.handleRequest(request)`。
- 导出 `POST` / `GET` / `DELETE` 均走同一处理（GET/DELETE 主要满足协议完整性，核心为 POST）。

### I. 前端页面（新增/编辑）

- **[app/login/page.tsx](file:///workspace/app/login/page.tsx)**（新增，client）：用户名/密码表单 → `POST /api/auth/login` → 成功后按 role 跳 `/admin`（admin）或 `/`；显示错误提示。
- **[app/admin/page.tsx](file:///workspace/app/admin/page.tsx)**（新增，client）：登录后可访问。
  - 顶部：当前用户名 + 「返回知识库」+ 「退出」。
  - **我的 API 密钥**：列出自己的 key（id/name/key/created_at），「创建密钥」→ 创建后高亮显示完整 key（便于 agent-browser 抓取），每行「删除」。
  - **用户管理**（仅 admin 显示）：列出用户（username/role/created_at/key 数量），「创建用户」表单（username/password），每行「删除」与「创建密钥」/删除其密钥。
  - 错误统一 try/catch + 文案提示，复用 [app/globals.css](file:///workspace/app/globals.css) 现有样式类（`.app`、`.small-btn` 等），新增少量内联或局部类。
- **[app/page.tsx](file:///workspace/app/page.tsx)（编辑，最小改动）**：在现有 `.app-header` 右侧加 `当前用户名 + 「后台」链接 + 「退出」按钮`（`GET /api/auth/me` 取用户；退出调 `/api/auth/logout` 后跳 `/login`）；处理 API 401（跳登录）。保持三栏主体逻辑不变。

---

## 验收步骤（Verification）

1. **编译/测试通过**：
   - `npm run build` 成功（注意：middleware 仅用 edge 安全模块；含 better-sqlite3 的路由均为 nodejs runtime）。
   - `npm run test` 现有用例仍通过（`handleSearchNotes`/`handleGetNote` 导出未变）。
2. **启动**：`npm run dev`（本地 http）。
3. **agent-browser 流程**：
   - 访问 `/` → 被中间件跳转 `/login`。
   - 用 `admin` / `Admin@123` 登录 → 落地 `/admin`。
   - 在「用户管理」创建账号 `test` / `123456`。
   - 创建一个 api_key（admin 自己的或 test 的）并从页面抓取完整 key。
4. **MCP 鉴权（用 MCP 客户端 SDK 验证）**，临时脚本示例：
   ```ts
   import { Client } from '@modelcontextprotocol/sdk/client/index.js';
   import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
   const mk = (key?: string) => new StreamableHTTPClientTransport(
     'http://localhost:3000/api/mcp',
     { requestInit: { headers: key ? { 'x-api-key': key } : {} } }
   );
   // 无 key / 错误 key：client.connect 应抛 401 错误。
   // 正确 key：connect 成功 → callTool 'search_notes' { query:'源清' } → 返回 count>0 的结果。
   ```
   - 不带/错误 api_key → 401（权限错误）。
   - 正确 api_key → 正常输出搜索内容（命中种子笔记「源清」）。
5. （可选）直接 `fetch` POST `/api/mcp` 一条 `tools/call` JSON-RPC 验证 401 与成功 SSE。

## 不在本次范围
- 云端实际部署（可后续用 lark-apps 技能）。
- api_key 哈希存储、密钥轮换、审计日志、多用户笔记隔离（notes 不加 owner，保持共享工作区）。
