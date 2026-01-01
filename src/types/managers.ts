/**
 * Manager related type definitions
 */

/**
 * Cache status information
 */
export interface CacheStatus {
  /** Directory path */
  directory: string;
  /** Number of cached files */
  fileCount: number;
  /** Cache timestamp */
  timestamp: number;
}

/**
 * Cache metadata
 */
export interface CacheMetadata {
  /** When the cache was created */
  createdAt: string;
  /** When the cache was last updated */
  updatedAt: string;
  /** Number of files in cache */
  fileCount: number;
  /** Search mode used */
  searchMode: 'single-level' | 'recursive';
}
