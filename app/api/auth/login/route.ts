import { serverError, badRequest } from '@/lib/apiError';
import { getUserByUsername } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import {
  signSession,
  sessionCookieOptions,
  SESSION_COOKIE,
} from '@/lib/session';
import { toPublicUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 速率限制参数（可通过 .env 配置）
const WINDOW_MS = Number(process.env.YUANQING_LOGIN_RATE_LIMIT_WINDOW_MS) || 300000; // 默认 5 分钟
const MAX_ATTEMPTS = Number(process.env.YUANQING_LOGIN_RATE_LIMIT_MAX_ATTEMPTS) || 5; // 默认 5 次

// 按 IP 记录失败次数的内存 Map（容器重启后清空）
const attempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && now < entry.resetAt) {
    return { allowed: entry.count < MAX_ATTEMPTS, retryAfterMs: entry.resetAt - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && now < entry.resetAt) {
    entry.count++;
  } else {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  }
}

function clearRateLimit(ip: string): void {
  attempts.delete(ip);
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  try {
    let body: { username?: unknown; password?: unknown };
    try {
      body = await request.json();
    } catch (err) {
      return badRequest('请求体格式无效', err);
    }

    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) {
      return Response.json({ error: '用户名和密码为必填项' }, { status: 400 });
    }

    const user = getUserByUsername(username);

    // 正确密码：直接登录成功，清空速率限制计数器
    if (user && verifyPassword(password, user.password_hash)) {
      clearRateLimit(ip);
      const sv = user.session_version ?? 0;
      const token = await signSession(user.id, sv);
      const opts = sessionCookieOptions();
      const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=${opts.path}; HttpOnly; SameSite=${opts.sameSite}; Max-Age=${opts.maxAge}${opts.secure ? '; Secure' : ''}`;
      return Response.json(
        { user: toPublicUser(user) },
        { status: 200, headers: { 'set-cookie': cookie } }
      );
    }

    // 错误密码：检查速率限制，未锁定则记录失败次数
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      const retryMin = Math.ceil(rl.retryAfterMs / 60000);
      return Response.json(
        { error: `登录尝试次数过多，请${retryMin}分钟后再试` },
        {
          status: 429,
          headers: { 'retry-after': String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    recordFailedAttempt(ip);
    return Response.json({ error: '用户名或密码错误' }, { status: 401 });
  } catch (err) {
    return serverError(err);
  }
}