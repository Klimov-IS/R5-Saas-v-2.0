/**
 * Simple in-memory rate limiter for API endpoints
 * Uses sliding window algorithm
 *
 * Production consideration: For multi-instance deployments,
 * replace with Redis-based rate limiting (e.g., ioredis + rate-limiter-flexible)
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry>;
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.store = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be allowed
   * @param key Unique identifier (e.g., API token or IP)
   * @returns Object with allowed status and remaining requests
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // No previous entry or window expired - allow and create new entry
    if (!entry || now > entry.resetAt) {
      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt,
      };
    }

    // Within window - check if limit exceeded
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    // Increment count and allow
    entry.count++;
    this.store.set(key, entry);
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Remove expired entries from store
   */
  private cleanup() {
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    for (const [key, entry] of entries) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a specific key (useful for testing)
   */
  reset(key: string) {
    this.store.delete(key);
  }

  /**
   * Get current stats for a key
   */
  getStats(key: string): RateLimitEntry | null {
    return this.store.get(key) || null;
  }
}

// Export singleton instance
// 100 requests per minute (60000ms) per API token
export const rateLimiter = new RateLimiter(60000, 100);

// For testing: export class to create custom instances
export { RateLimiter };
