import type { FileInfo } from './file-search-types.js';

// Cache metadata for a cached directory
export interface FileCacheMetadata {
  version: string;
  directory: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  searchMode?: 'recursive';   // Always 'recursive' (single stage with fd)
  gitignoreRespected?: boolean;
  ttlSeconds?: number;
}

// Cached directory data returned from FileCacheManager
export interface CachedDirectoryData {
  directory: string;
  files: FileInfo[];
  metadata: FileCacheMetadata;
}

// Cache entry stored in files.jsonl
export interface CachedFileEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: number;
}

// Global cache metadata for tracking recent directories
export interface GlobalCacheMetadata {
  version: string;
  lastUsedDirectory: string | null;
  lastUsedAt: string | null;
  recentDirectories: Array<{
    directory: string;
    lastUsedAt: string;
  }>;
}

// Cache statistics
export interface FileCacheStats {
  totalCaches: number;
  totalFiles: number;
  oldestCache: string | null;
  newestCache: string | null;
  totalSizeBytes: number;
}
