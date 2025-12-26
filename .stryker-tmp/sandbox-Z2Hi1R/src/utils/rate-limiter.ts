/**
 * Rate Limiter Utility
 *
 * Provides configurable rate limiting to prevent abuse and DoS attacks.
 * Uses a sliding window algorithm with per-key tracking.
 */
// @ts-nocheck


interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Maximum requests allowed within the window
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed for the given key
   * @param key - Unique identifier for the rate limit (e.g., 'paste', 'history')
   * @returns true if request is allowed, false if rate limit exceeded
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get current request history for this key
    let timestamps = this.requests.get(key) || [];

    // Remove timestamps outside the current window
    timestamps = timestamps.filter(ts => ts > windowStart);

    // Check if we've exceeded the limit
    if (timestamps.length >= this.config.maxRequests) {
      return false;
    }

    // Add current request timestamp
    timestamps.push(now);
    this.requests.set(key, timestamps);
    return true;
  }

  /**
   * Reset rate limit for a specific key
   * @param key - Key to reset
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  resetAll(): void {
    this.requests.clear();
  }

  /**
   * Get current request count for a key
   * @param key - Key to check
   * @returns Number of requests in the current window
   */
  getCount(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const timestamps = this.requests.get(key) || [];
    return timestamps.filter(ts => ts > windowStart).length;
  }

  /**
   * Get time until next request is allowed (in milliseconds)
   * Returns 0 if request is currently allowed
   * @param key - Key to check
   * @returns Milliseconds until next request is allowed
   */
  getTimeUntilReset(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(ts => ts > windowStart);

    if (validTimestamps.length < this.config.maxRequests) {
      return 0;
    }

    // Find the oldest timestamp and calculate when it will expire
    const oldestTimestamp = Math.min(...validTimestamps);
    return Math.max(0, oldestTimestamp + this.config.windowMs - now);
  }
}

// Pre-configured rate limiters for common operations
export const pasteRateLimiter = new RateLimiter({
  windowMs: 1000,      // 1 second window
  maxRequests: 10      // Maximum 10 paste operations per second
});

export const historyRateLimiter = new RateLimiter({
  windowMs: 1000,      // 1 second window
  maxRequests: 50      // Maximum 50 history operations per second
});

export const imageRateLimiter = new RateLimiter({
  windowMs: 1000,      // 1 second window
  maxRequests: 5       // Maximum 5 image paste operations per second
});

export { RateLimiter, RateLimitConfig };
