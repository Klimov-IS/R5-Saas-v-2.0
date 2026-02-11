import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware:
 * 1. CORS for Chrome Extension (API routes)
 * 2. Auth redirect for UI pages (cookie check only — JWT verified in route handlers)
 *
 * Note: Full JWT verification + DB queries happen in route handlers,
 * because Edge Runtime doesn't support Node.js modules (pg, jsonwebtoken).
 */

// Pages that don't require auth
const PUBLIC_PATHS = ['/login', '/register', '/api/', '/tg', '/_next/', '/favicon'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // --- CORS for Chrome Extension (API routes) ---
  if (pathname.startsWith('/api/')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Init-Data',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const response = NextResponse.next();
    if (origin && origin.startsWith('chrome-extension://')) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
    }
    return response;
  }

  // --- Auth redirect for UI pages ---
  if (!isPublicPath(pathname)) {
    const token = request.cookies.get('r5_token')?.value;
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // API routes (CORS)
    '/api/:path*',
    // UI pages (auth redirect) — exclude static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
