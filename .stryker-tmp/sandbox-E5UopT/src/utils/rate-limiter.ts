/**
 * Rate Limiter Utility
 *
 * Provides configurable rate limiting to prevent abuse and DoS attacks.
 * Uses a sliding window algorithm with per-key tracking.
 */
// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests allowed within the window
}
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;
  constructor(config: RateLimitConfig) {
    if (stryMutAct_9fa48("5439")) {
      {}
    } else {
      stryCov_9fa48("5439");
      this.config = config;
    }
  }

  /**
   * Check if a request is allowed for the given key
   * @param key - Unique identifier for the rate limit (e.g., 'paste', 'history')
   * @returns true if request is allowed, false if rate limit exceeded
   */
  isAllowed(key: string): boolean {
    if (stryMutAct_9fa48("5440")) {
      {}
    } else {
      stryCov_9fa48("5440");
      const now = Date.now();
      const windowStart = stryMutAct_9fa48("5441") ? now + this.config.windowMs : (stryCov_9fa48("5441"), now - this.config.windowMs);

      // Get current request history for this key
      let timestamps = stryMutAct_9fa48("5444") ? this.requests.get(key) && [] : stryMutAct_9fa48("5443") ? false : stryMutAct_9fa48("5442") ? true : (stryCov_9fa48("5442", "5443", "5444"), this.requests.get(key) || (stryMutAct_9fa48("5445") ? ["Stryker was here"] : (stryCov_9fa48("5445"), [])));

      // Remove timestamps outside the current window
      timestamps = stryMutAct_9fa48("5446") ? timestamps : (stryCov_9fa48("5446"), timestamps.filter(stryMutAct_9fa48("5447") ? () => undefined : (stryCov_9fa48("5447"), ts => stryMutAct_9fa48("5451") ? ts <= windowStart : stryMutAct_9fa48("5450") ? ts >= windowStart : stryMutAct_9fa48("5449") ? false : stryMutAct_9fa48("5448") ? true : (stryCov_9fa48("5448", "5449", "5450", "5451"), ts > windowStart))));

      // Check if we've exceeded the limit
      if (stryMutAct_9fa48("5455") ? timestamps.length < this.config.maxRequests : stryMutAct_9fa48("5454") ? timestamps.length > this.config.maxRequests : stryMutAct_9fa48("5453") ? false : stryMutAct_9fa48("5452") ? true : (stryCov_9fa48("5452", "5453", "5454", "5455"), timestamps.length >= this.config.maxRequests)) {
        if (stryMutAct_9fa48("5456")) {
          {}
        } else {
          stryCov_9fa48("5456");
          return stryMutAct_9fa48("5457") ? true : (stryCov_9fa48("5457"), false);
        }
      }

      // Add current request timestamp
      timestamps.push(now);
      this.requests.set(key, timestamps);
      return stryMutAct_9fa48("5458") ? false : (stryCov_9fa48("5458"), true);
    }
  }

  /**
   * Reset rate limit for a specific key
   * @param key - Key to reset
   */
  reset(key: string): void {
    if (stryMutAct_9fa48("5459")) {
      {}
    } else {
      stryCov_9fa48("5459");
      this.requests.delete(key);
    }
  }

  /**
   * Clear all rate limit data
   */
  resetAll(): void {
    if (stryMutAct_9fa48("5460")) {
      {}
    } else {
      stryCov_9fa48("5460");
      this.requests.clear();
    }
  }

  /**
   * Get current request count for a key
   * @param key - Key to check
   * @returns Number of requests in the current window
   */
  getCount(key: string): number {
    if (stryMutAct_9fa48("5461")) {
      {}
    } else {
      stryCov_9fa48("5461");
      const now = Date.now();
      const windowStart = stryMutAct_9fa48("5462") ? now + this.config.windowMs : (stryCov_9fa48("5462"), now - this.config.windowMs);
      const timestamps = stryMutAct_9fa48("5465") ? this.requests.get(key) && [] : stryMutAct_9fa48("5464") ? false : stryMutAct_9fa48("5463") ? true : (stryCov_9fa48("5463", "5464", "5465"), this.requests.get(key) || (stryMutAct_9fa48("5466") ? ["Stryker was here"] : (stryCov_9fa48("5466"), [])));
      return stryMutAct_9fa48("5467") ? timestamps.length : (stryCov_9fa48("5467"), timestamps.filter(stryMutAct_9fa48("5468") ? () => undefined : (stryCov_9fa48("5468"), ts => stryMutAct_9fa48("5472") ? ts <= windowStart : stryMutAct_9fa48("5471") ? ts >= windowStart : stryMutAct_9fa48("5470") ? false : stryMutAct_9fa48("5469") ? true : (stryCov_9fa48("5469", "5470", "5471", "5472"), ts > windowStart))).length);
    }
  }

  /**
   * Get time until next request is allowed (in milliseconds)
   * Returns 0 if request is currently allowed
   * @param key - Key to check
   * @returns Milliseconds until next request is allowed
   */
  getTimeUntilReset(key: string): number {
    if (stryMutAct_9fa48("5473")) {
      {}
    } else {
      stryCov_9fa48("5473");
      const now = Date.now();
      const windowStart = stryMutAct_9fa48("5474") ? now + this.config.windowMs : (stryCov_9fa48("5474"), now - this.config.windowMs);
      const timestamps = stryMutAct_9fa48("5477") ? this.requests.get(key) && [] : stryMutAct_9fa48("5476") ? false : stryMutAct_9fa48("5475") ? true : (stryCov_9fa48("5475", "5476", "5477"), this.requests.get(key) || (stryMutAct_9fa48("5478") ? ["Stryker was here"] : (stryCov_9fa48("5478"), [])));
      const validTimestamps = stryMutAct_9fa48("5479") ? timestamps : (stryCov_9fa48("5479"), timestamps.filter(stryMutAct_9fa48("5480") ? () => undefined : (stryCov_9fa48("5480"), ts => stryMutAct_9fa48("5484") ? ts <= windowStart : stryMutAct_9fa48("5483") ? ts >= windowStart : stryMutAct_9fa48("5482") ? false : stryMutAct_9fa48("5481") ? true : (stryCov_9fa48("5481", "5482", "5483", "5484"), ts > windowStart))));
      if (stryMutAct_9fa48("5488") ? validTimestamps.length >= this.config.maxRequests : stryMutAct_9fa48("5487") ? validTimestamps.length <= this.config.maxRequests : stryMutAct_9fa48("5486") ? false : stryMutAct_9fa48("5485") ? true : (stryCov_9fa48("5485", "5486", "5487", "5488"), validTimestamps.length < this.config.maxRequests)) {
        if (stryMutAct_9fa48("5489")) {
          {}
        } else {
          stryCov_9fa48("5489");
          return 0;
        }
      }

      // Find the oldest timestamp and calculate when it will expire
      const oldestTimestamp = stryMutAct_9fa48("5490") ? Math.max(...validTimestamps) : (stryCov_9fa48("5490"), Math.min(...validTimestamps));
      return stryMutAct_9fa48("5491") ? Math.min(0, oldestTimestamp + this.config.windowMs - now) : (stryCov_9fa48("5491"), Math.max(0, stryMutAct_9fa48("5492") ? oldestTimestamp + this.config.windowMs + now : (stryCov_9fa48("5492"), (stryMutAct_9fa48("5493") ? oldestTimestamp - this.config.windowMs : (stryCov_9fa48("5493"), oldestTimestamp + this.config.windowMs)) - now)));
    }
  }
}

// Pre-configured rate limiters for common operations
export const pasteRateLimiter = new RateLimiter(stryMutAct_9fa48("5494") ? {} : (stryCov_9fa48("5494"), {
  windowMs: 1000,
  // 1 second window
  maxRequests: 10 // Maximum 10 paste operations per second
}));
export const historyRateLimiter = new RateLimiter(stryMutAct_9fa48("5495") ? {} : (stryCov_9fa48("5495"), {
  windowMs: 1000,
  // 1 second window
  maxRequests: 50 // Maximum 50 history operations per second
}));
export const imageRateLimiter = new RateLimiter(stryMutAct_9fa48("5496") ? {} : (stryCov_9fa48("5496"), {
  windowMs: 1000,
  // 1 second window
  maxRequests: 5 // Maximum 5 image paste operations per second
}));
export { RateLimiter, RateLimitConfig };