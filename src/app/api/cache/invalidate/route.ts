import { NextRequest, NextResponse } from 'next/server';
import { invalidateCache, clearCache, getCacheStats } from '@/lib/api-key-cache';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * POST /api/cache/invalidate
 * Invalidate specific API key(s) from cache
 *
 * Body:
 * - { apiKey: string } - invalidate specific key
 * - { apiKeys: string[] } - invalidate multiple keys
 * - { clearAll: true } - clear entire cache (use with caution!)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const { authorized, error } = await verifyApiKey(request);
    if (!authorized) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Option 1: Clear entire cache
    if (body.clearAll === true) {
      clearCache();
      return NextResponse.json({
        success: true,
        message: 'Entire cache cleared',
        stats: getCacheStats()
      });
    }

    // Option 2: Invalidate multiple keys
    if (body.apiKeys && Array.isArray(body.apiKeys)) {
      const results = body.apiKeys.map((key: string) => ({
        apiKey: key.substring(0, 10) + '...',
        invalidated: invalidateCache(key)
      }));

      return NextResponse.json({
        success: true,
        message: `Invalidated ${results.filter(r => r.invalidated).length} keys`,
        results,
        stats: getCacheStats()
      });
    }

    // Option 3: Invalidate single key
    if (body.apiKey) {
      const invalidated = invalidateCache(body.apiKey);

      return NextResponse.json({
        success: true,
        invalidated,
        message: invalidated
          ? 'API key invalidated successfully'
          : 'API key was not in cache',
        stats: getCacheStats()
      });
    }

    return NextResponse.json(
      { error: 'Missing required parameter: apiKey, apiKeys, or clearAll' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[POST /api/cache/invalidate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate cache', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cache/invalidate
 * Get cache statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const { authorized, error } = await verifyApiKey(request);
    if (!authorized) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = getCacheStats();

    return NextResponse.json({
      success: true,
      stats,
      message: `Cache contains ${stats.totalEntries} entries`
    });
  } catch (error: any) {
    console.error('[GET /api/cache/invalidate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache stats', details: error.message },
      { status: 500 }
    );
  }
}
