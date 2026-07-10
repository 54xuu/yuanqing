import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from './lib/session';

// This middleware runs on the Edge runtime and ONLY imports the edge-safe
// session helpers (no DB, no node:crypto). It gates the entire app behind a
// login session, except for /login, the login API, and the api_key-based MCP
// endpoint.

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token ?? null);

  if (userId) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // API requests get a 401 JSON; page requests redirect to /login.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Run on everything except: login page, login API, MCP endpoint (api_key
    // auth handled in-route), and Next.js static/image assets.
    '/((?!login|api/auth/login|api/mcp|_next/static|_next/image|favicon.ico).*)',
  ],
};
