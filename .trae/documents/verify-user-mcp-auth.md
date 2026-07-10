# 用户管理 + MCP 鉴权 — 验收验证计划

## 概述（Summary）

实现已完成（计划见 [user-management-and-mcp-auth.md](file:///workspace/.trae/documents/user-management-and-mcp-auth.md)）：内置 admin、用户管理 API、api_key 管理、cookie 会话中间件、`/api/mcp` HTTP 端点（api_key 鉴权）。本计划只覆盖**剩余的运行时验收验证**，对应需求 4 条验收标准：

1. 编译通过 ✅（已验证，本次重跑确认）
2. agent-browser 操作浏览器：登录系统、创建账号 `test`/`123456`、创建 `api key`
3. 不带/错误 api_key 访问 MCP 报权限错误
4. 正确 api_key 访问 MCP 正常输出搜索内容

---

## 当前状态分析（Current State Analysis）

已确认在盘的关键实现（Phase 1 已读）：

- [middleware.ts](file:///workspace/middleware.ts)：Edge 会话守卫，放行 `/login`、`/api/auth/login`、`/api/mcp`、静态资源；其余无会话则 API 401 / 页面 302→`/login`。
- [app/api/mcp/route.ts](file:///workspace/app/api/mcp/route.ts)：`extractApiKey` 读 `x-api-key` 或 `Authorization: Bearer`；无/错 key 返回 401 JSON-RPC error；通过则 stateless transport 处理请求。
- [app/login/page.tsx](file:///workspace/app/login/page.tsx)：表单 `input#username`、`input#password`、`button.auth-submit`；admin 登录后跳 `/admin`。
- [app/admin/page.tsx](file:///workspace/app/admin/page.tsx)：
  - 「我的 API 密钥」card：input[placeholder="密钥名称（可选）"] + button「创建密钥」；新密钥渲染在 `[data-testid="new-api-key"]`。
  - 「用户管理」card（admin only）：input[placeholder="用户名"] + input[type=password][placeholder="密码"] + button「创建用户」；每行有「创建密钥」按钮，新 key 渲染在 `[data-testid="new-key-{userId}"]`。
- [lib/auth.ts](file:///workspace/lib/auth.ts)：`requireAdmin`/`requireUser` + `getCurrentUser`。
- [lib/db.ts](file:///workspace/lib/db.ts)：`seedAdmin` 创建 `admin`/`Admin@123`；`createApiKey` 生成 `yq_` 前缀 key。
- [package.json](file:///workspace/package.json)：`dev` = `next dev`（默认 :3000），`build`、`test` 就绪；依赖含 `@modelcontextprotocol/sdk` ^1.29。

环境：远程沙箱 linux，非交互（CI=true）。dev server 须以后台非阻塞方式启动。

---

## 拟定步骤（Proposed Changes / 执行步骤）

### 步骤 0 — 重确认编译与测试（验收 #1）

- `npm run build`（Turbopack）成功，确认无回归。
- `npm run test`（vitest）24 个用例通过。
- 两者任一失败则停止并修复后再继续。

### 步骤 1 — 启动 dev server

- 后台非阻塞启动 `npm run dev`（`RunCommand` blocking=false, command_type=web_server），等待 `Ready in` / 监听 :3000 的就绪标记。
- 健康检查：`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login` 应为 200；访问 `/` 应 302 跳 `/login`（验收中间件生效）。

### 步骤 2 — agent-browser 浏览器流程（验收 #2）

通过 `Skill` 调用 agent-browser，按顺序操作：

1. 打开 `http://localhost:3000/` → 断言被重定向到 `/login`（URL 含 `/login`）。
2. 在登录页：
   - 填 `input#username` = `admin`
   - 填 `input#password` = `Admin@123`
   - 点击 `button.auth-submit`
   - 断言落地 URL 为 `/admin`（admin 跳转）。
3. 在「用户管理」card 创建账号：
   - 填 input[placeholder="用户名"] = `test`
   - 填 input[type=password][placeholder="密码"] = `123456`
   - 点击 button「创建用户」
   - 断言用户表格出现 `test` 行。
4. 创建 api_key（用「我的 API 密钥」card，admin 自己的 key 即可满足验收）：
   - （可选）填 input[placeholder="密钥名称（可选）"] = `verify`
   - 点击「我的 API 密钥」card 内 button「创建密钥」
   - 从 `[data-testid="new-api-key"]` 抓取完整 key 文本（形如 `yq_...`），保存供步骤 3/4 使用。
   - 断言 key 非空且以 `yq_` 开头。

> 备用：若「我的密钥」流程抓取失败，改在 `test` 用户行点「创建密钥」，从 `[data-testid="new-key-{userId}"]` 抓取。

### 步骤 3 — MCP 鉴权验证（验收 #3 + #4）

用 SDK 客户端验证最贴近真实 MCP 调用。写一个**临时**验证脚本 `verify-mcp.mjs`（项目根，验证后删除）：

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const URL = 'http://localhost:3000/api/mcp';
const mk = (key) => new StreamableHTTPClientTransport(URL, {
  requestInit: { headers: key ? { 'x-api-key': key } : {} },
});

async function tryConnect(label, key) {
  const client = new Client({ name: 'verify', version: '0.0.0' });
  try {
    await client.connect(mk(key));
    console.log(`${label}: CONNECT_OK`);
    return client;
  } catch (e) {
    console.log(`${label}: CONNECT_FAIL ${e.status ?? ''} ${e.message}`);
    return null;
  }
}

// 验收 #3：无 key / 错 key 必须失败
await tryConnect('NO_KEY', undefined);
await tryConnect('WRONG_KEY', 'yq_invalid_wrong_key');

// 验收 #4：正确 key → 连接成功 → search_notes 命中「源清」
const GOOD = process.env.YQ_KEY;
const c = await tryConnect('GOOD_KEY', GOOD);
if (c) {
  const r = await c.callTool({ name: 'search_notes', arguments: { query: '源清' } });
  const text = JSON.stringify(r.content ?? r);
  console.log('GOOD_KEY: TOOL_RESULT', text.slice(0, 200));
  await c.close();
}
```

运行：`YQ_KEY=<步骤2抓取的key> node verify-mcp.mjs`

预期输出：
- `NO_KEY: CONNECT_FAIL ... 401 ...`
- `WRONG_KEY: CONNECT_FAIL ... 401 ...`
- `GOOD_KEY: CONNECT_OK` 且 `GOOD_KEY: TOOL_RESULT` 含 `源清` / `count`>0 的搜索结果（命中种子笔记）。

> 备用（更轻量，不依赖客户端握手）：对 #3 用 `curl -i -X POST http://localhost:3000/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{...}}'`，无/错 key 断言 HTTP 401。但 #4 必须用 SDK 客户端完成 initialize+callTool，故统一用临时脚本最稳。

验证通过后删除 `verify-mcp.mjs`。

### 步骤 4 — 收尾

- 停止 dev server（`StopCommand`）。
- 确认无新增遗留文件（临时脚本已删；DB 文件 `yuanqing.db` 是运行产物，不纳入代码变更）。
- 向用户汇报 4 条验收标准逐项结果。

---

## 假设与决策（Assumptions & Decisions）

1. **不改动实现代码**：本计划纯验证。仅当验证暴露真实 bug 时才回改实现（届时单独说明）。
2. **dev server 端口 3000**：Next 默认，无冲突假设。
3. **api_key 用 admin 自己的**：验收标准未限定 key 归属，admin 自建 key 最简；仍会创建 `test` 账号以满足 #2。
4. **临时脚本 `verify-mcp.mjs`**：用 `.mjs` 直接跑 ESM，无需 tsx；验证后删除，不污染仓库。
5. **agent-browser 选择器**：优先 `id`/`placeholder`/可见按钮文案与 `data-testid`，避免脆弱的 nth-child。
6. **DB 状态**：验证会在 `yuanqing.db` 写入 admin 登录会话、`test` 用户、1 个 api_key。这是预期运行产物，不需回滚。

---

## 验收标准对照（Verification Mapping）

| 验收标准 | 验证方式 | 通过判据 |
|---|---|---|
| #1 编译通过 | `npm run build` + `npm run test` | build 成功、24 测试通过 |
| #2 浏览器登录/建号/建 key | agent-browser 步骤 2 | 登录落 `/admin`；用户表含 `test`；抓到 `yq_` key |
| #3 无/错 key 报权限错误 | `verify-mcp.mjs` NO_KEY/WRONG_KEY | 两次 CONNECT_FAIL（401） |
| #4 正确 key 输出搜索内容 | `verify-mcp.mjs` GOOD_KEY + callTool | CONNECT_OK + search_notes 返回命中「源清」 |
