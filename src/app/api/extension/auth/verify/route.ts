/**
 * Extension Authentication Endpoint
 *
 * GET /api/extension/auth/verify
 *
 * Verifies the API token and returns user info + accessible stores.
 *
 * @version 1.0.0
 * @date 2026-01-10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken, getUserStores } from '@/db/extension-helpers';

/**
 * GET /api/extension/auth/verify
 *
 * Headers:
 *   Authorization: Bearer wbrm_<token>
 *
 * Response 200:
 *   {
 *     "valid": true,
 *     "user": { "id": "...", "email": "...", "name": "..." },
 *     "stores": ["store1", "store2"]
 *   }
 *
 * Response 401:
 *   { "error": "Unauthorized", "message": "..." }
 */
export async function GET(request: NextRequest) {
  console.log('[Extension Auth] 🔐 Token verification request');

  try {
    // 1. Extract token from Authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[Extension Auth] ❌ Missing or invalid Authorization header');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // 2. Validate token format
    if (!token.startsWith('wbrm_')) {
      console.warn('[Extension Auth] ❌ Invalid token format');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid token format' },
        { status: 401 }
      );
    }

    // 3. Find user by token
    const user = await getUserByApiToken(token);

    if (!user) {
      console.warn('[Extension Auth] ❌ Token not found in database');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid token' },
        { status: 401 }
      );
    }

    // 4. Get user's stores
    const storeIds = await getUserStores(user.id);

    console.log(`[Extension Auth] ✅ Token verified for user ${user.email}, ${storeIds.length} stores found`);

    // 5. Return success response
    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email,
      },
      stores: storeIds,
    });

  } catch (error: any) {
    console.error('[Extension Auth] ❌ Error during token verification:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
