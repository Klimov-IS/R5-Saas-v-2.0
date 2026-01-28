import { query } from '@/db/client';

/**
 * API Authentication utilities for Chrome Extension endpoints
 */

export interface ApiToken {
  id: string;
  store_id: string;
  token: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Verify API token from Authorization header
 * @param authHeader Authorization header value (e.g., "Bearer token123")
 * @returns ApiToken if valid, null if invalid
 */
export async function verifyApiToken(authHeader: string | null): Promise<ApiToken | null> {
  if (!authHeader) {
    return null;
  }

  // Extract token from "Bearer <token>" format
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1];

  try {
    // Query database for token
    const result = await query<ApiToken>(
      `SELECT
        id,
        store_id,
        token,
        name,
        is_active,
        created_at,
        last_used_at
       FROM api_tokens
       WHERE token = $1 AND is_active = true`,
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const apiToken = result.rows[0];

    // Update last_used_at timestamp (fire and forget)
    query(
      `UPDATE api_tokens
       SET last_used_at = NOW()
       WHERE id = $1`,
      [apiToken.id]
    ).catch((err) => {
      console.error('Failed to update last_used_at for API token:', err);
    });

    return apiToken;
  } catch (error) {
    console.error('Error verifying API token:', error);
    return null;
  }
}

/**
 * Extract store ID from verified token
 */
export function getStoreIdFromToken(token: ApiToken): string {
  return token.store_id;
}

/**
 * Check if token has access to specific store
 */
export function hasStoreAccess(token: ApiToken, storeId: string): boolean {
  return token.store_id === storeId;
}
