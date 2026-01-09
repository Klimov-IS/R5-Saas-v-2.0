import { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import * as apiKeyCache from './api-key-cache';

/**
 * Verify API key from request headers
 * Returns authorization result with user settings if valid
 *
 * Performance optimization:
 * - Uses in-memory cache to avoid repeated database queries
 * - Cache TTL: 5 minutes
 * - Expected improvement: ~1300ms → ~1ms for cached keys
 */
export async function verifyApiKey(request: NextRequest): Promise<{
  authorized: boolean;
  error?: string;
  userSettings?: any;
}> {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return {
        authorized: false,
        error: 'Authorization header is missing'
      };
    }

    // Expected format: "Bearer <api_key>"
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return {
        authorized: false,
        error: 'Invalid Authorization header format. Expected: Bearer <api_key>'
      };
    }

    const apiKey = match[1];

    // Check cache first
    const cached = apiKeyCache.getCached(apiKey);
    if (cached) {
      return {
        authorized: true,
        userSettings: cached
      };
    }

    // Verify API key against database (only if not in cache)
    const userSettings = await dbHelpers.verifyApiKey(apiKey);

    if (!userSettings) {
      return {
        authorized: false,
        error: 'Invalid API key'
      };
    }

    // Store in cache for future requests
    apiKeyCache.setCached(apiKey, userSettings);

    return {
      authorized: true,
      userSettings
    };

  } catch (error: any) {
    console.error('[verifyApiKey] Error:', error);
    return {
      authorized: false,
      error: 'Failed to verify API key'
    };
  }
}
