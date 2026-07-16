import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from './lib/session';

// Edge middleware only verifies signature + expiry (no DB). Stale session_version
// tokens are rejected by /api/auth/me (Node + DB), which clears the cookie.
// Do NOT auto-redirect /login → / here; the login page checks /api/auth/me instead.

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token ?? null);
  const userId = payload?.uid ?? null;
  const { pathname } = request.nextUrl;

  if (userId) {
    return NextResponse.next();
  }

  // Unauthenticated user visiting /login — allow (show login form).
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // API requests get a 401 JSON; page requests redirect to /login.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Run on everything except: login API, MCP endpoint (api_key auth
    // handled in-route), and Next.js static/image assets.
    '/((?!api/auth/login|api/mcp|_next/static|_next/image|favicon.ico).*)',
  ],
};
