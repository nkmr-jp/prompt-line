/**
 * Base Cache Manager - Abstract base class for cache management
 *
 * Provides common caching functionality:
 * - In-memory Map-based cache storage
 * - Cache miss handling with async loading
 * - Cache clearing and validation
 *
 * Subclasses must implement:
 * - fetchValue(key): Fetch value from source when cache misses
 */

/**
 * Abstract base class for cache managers
 * @template K - Cache key type
 * @template V - Cache value type
 */
export abstract class BaseCacheManager<K, V> {
  protected cache: Map<K, V> = new Map();

  /**
   * Get cached value or fetch if not in cache
   * @param key - Cache key
   * @returns Cached or fetched value
   */
  protected async getOrFetch(key: K): Promise<V> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Cache miss - fetch and store
    const value = await this.fetchValue(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Get cached value (synchronous)
   * @param key - Cache key
   * @returns Cached value or undefined if not in cache
   */
  protected getCached(key: K): V | undefined {
    return this.cache.get(key);
  }

  /**
   * Set cached value
   * @param key - Cache key
   * @param value - Value to cache
   */
  protected setCached(key: K, value: V): void {
    this.cache.set(key, value);
  }

  /**
   * Check if key exists in cache
   * @param key - Cache key
   * @returns True if key exists in cache
   */
  protected hasCache(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear cache for specific key
   * @param key - Cache key to clear
   */
  protected clearCacheKey(key: K): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached values
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns Number of cached items
   */
  protected getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Abstract method: Fetch value from source
   * Subclasses must implement this to define how to fetch values on cache miss
   * @param key - Cache key
   * @returns Promise resolving to the fetched value
   */
  protected abstract fetchValue(key: K): Promise<V>;
}
