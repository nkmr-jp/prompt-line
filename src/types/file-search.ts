/**
 * File search domain type definitions
 */

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink?: boolean;
  size?: number;
  modifiedAt?: string;
  mtimeMs?: number;  // File modification time in milliseconds - for usage bonus calculation
  error?: string;
}

export interface DirectoryInfo {
  success?: boolean;
  directory?: string;
  files?: FileInfo[];
  fileCount?: number;
  tty?: string;
  pid?: number;
  idePid?: number;
  method?: 'tty' | 'window-title' | 'ide-shell-fast' | 'electron-pty';
  appName?: string;
  bundleId?: string;
  error?: string;
  filesError?: string;
  // File search related fields (fd is always used)
  partial?: boolean;          // Always false (single stage with fd)
  searchMode?: 'recursive';   // Always 'recursive' (single stage with fd)
  // Draft directory fallback related fields
  directoryChanged?: boolean;  // true if directory changed from previous (draft) directory
  previousDirectory?: string;  // previous directory (from draft) for comparison
  fromDraft?: boolean;         // true if this data is from draft fallback (not actual detection)
  // Cache related fields
  fromCache?: boolean;         // true if data was loaded from cache
  cacheAge?: number;           // milliseconds since cache was updated
  // Detection status
  detectionTimedOut?: boolean; // true if directory detection timed out (e.g., large directories like home)
  // File limit status
  fileLimitReached?: boolean;  // true if file count reached maxFiles limit
  maxFiles?: number;           // the maxFiles limit that was applied
  // User hint message
  hint?: string;               // hint message to display to user (e.g., "Install fd: brew install fd")
  // Git repository status
  isGitRepository?: boolean;   // true if directory is inside a git repository
  // File search disabled status
  filesDisabled?: boolean;     // true if file search is disabled for this directory
  filesDisabledReason?: string; // reason why file search is disabled
}

// File search settings configuration
export interface FileSearchSettings {
  // Respect .gitignore files (fd only, default: true)
  respectGitignore: boolean;
  // Additional exclude patterns (applied on top of .gitignore)
  excludePatterns: string[];
  // Include patterns (force include even if in .gitignore)
  includePatterns: string[];
  // Maximum number of files to return (default: 5000)
  maxFiles: number;
  // Include hidden files (starting with .)
  includeHidden: boolean;
  // Maximum directory depth (null = unlimited)
  maxDepth: number | null;
  // Follow symbolic links (default: false)
  followSymlinks: boolean;
  // Custom path to fd command (null = auto-detect from common paths)
  fdPath: string | null;
  // Input format for file path expansion (default: 'path')
  // 'name': insert only the file name (e.g., "config.ts")
  // 'path': insert the relative path (e.g., "src/config.ts")
  inputFormat?: InputFormatType;
  // Maximum number of suggestions to show (default: 50)
  maxSuggestions?: number;
}

// Directory data for file search (cached in renderer)
export interface DirectoryData {
  directory: string;
  files: FileInfo[];
  timestamp: number;
  partial?: boolean;          // Always false (single stage with fd)
  searchMode?: 'recursive';   // Always 'recursive' (single stage with fd)
  fromDraft?: boolean;        // true if data is from draft fallback
  filesDisabled?: boolean;    // true if file search is disabled for this directory
  filesDisabledReason?: string; // reason why file search is disabled
  hint?: string;              // hint message to display to user
}

// ============================================================================
// File Cache Related Types
// ============================================================================

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

// ============================================================================
// Input Format Type (shared across file-search and mdsearch)
// ============================================================================

/**
 * 入力フォーマットの種類
 * - name: 名前のみを挿入（例: "config.ts"）
 * - path: パスを挿入（例: "src/config.ts"）
 */
export type InputFormatType = 'name' | 'path';
