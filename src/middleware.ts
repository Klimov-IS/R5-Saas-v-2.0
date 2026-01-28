import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyApiToken, hasStoreAccess } from '@/lib/api-auth';
import { rateLimiter } from '@/lib/rate-limiter';

/**
 * Middleware to handle:
 * - CORS for Chrome Extension
 * - API Authentication
 * - Rate Limiting (100 req/min per token)
 */
export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Skip auth for health endpoint
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  // API Authentication - verify Bearer token
  const authHeader = request.headers.get('authorization');
  const apiToken = await verifyApiToken(authHeader);

  if (!apiToken) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or missing API token',
        code: 'INVALID_TOKEN',
      },
      {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': origin && origin.startsWith('chrome-extension://') ? origin : '*',
        },
      }
    );
  }

  // Rate Limiting - 100 requests per minute per token
  const rateLimitKey = `api_token_${apiToken.id}`;
  const rateLimit = rateLimiter.check(rateLimitKey);

  if (!rateLimit.allowed) {
    const resetDate = new Date(rateLimit.resetAt).toISOString();
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Maximum 100 requests per minute.',
        code: 'RATE_LIMIT_EXCEEDED',
        resetAt: resetDate,
      },
      {
        status: 429,
        headers: {
          'Access-Control-Allow-Origin': origin && origin.startsWith('chrome-extension://') ? origin : '*',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetDate,
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Verify store access for /api/stores/:storeId/* routes
  const storeIdMatch = request.nextUrl.pathname.match(/^\/api\/stores\/([^/]+)/);
  if (storeIdMatch) {
    const requestedStoreId = storeIdMatch[1];
    if (!hasStoreAccess(apiToken, requestedStoreId)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Token does not have access to this store',
          code: 'STORE_ACCESS_DENIED',
        },
        {
          status: 403,
          headers: {
            'Access-Control-Allow-Origin': origin && origin.startsWith('chrome-extension://') ? origin : '*',
          },
        }
      );
    }
  }

  // Handle actual requests with CORS headers
  const response = NextResponse.next();

  // Add CORS headers for Chrome Extension
  if (origin && origin.startsWith('chrome-extension://')) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', '100');
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetAt).toISOString());

  return response;
}

// Apply middleware to Extension API routes
export const config = {
  matcher: ['/api/stores/:path*', '/api/health'],
};
