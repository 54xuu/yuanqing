import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from './lib/session';

// This middleware runs on the Edge runtime and ONLY imports the edge-safe
// session helpers (no DB, no node:crypto). It gates the entire app behind a
// login session, except for the login API and the api_key-based MCP
// endpoint. It also redirects already-authenticated users
// away from the login page (to the notes home).

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token ?? null);
  const { pathname } = request.nextUrl;

  // Already-authenticated user visiting /login — redirect to notes home (or next).
  // Avoids showing the login form to already-logged-in users.
  if (userId && pathname === '/login') {
    const next = request.nextUrl.searchParams.get('next');
    const target = next && next !== '/login' ? next : '/';
    return NextResponse.redirect(new URL(target, request.url));
  }

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
