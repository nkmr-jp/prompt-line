import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';
import config from '../config/app-config';
import { logger } from '../utils/utils';
import type {
  FileInfo,
  FileCacheMetadata,
  CachedDirectoryData,
  GlobalCacheMetadata,
  FileCacheStats,
  CachedFileEntry
} from '../types';

class FileCacheManager {
  private cacheDir: string;
  private globalMetadataPath: string;
  private static readonly CACHE_VERSION = '1.0';
  private static readonly DEFAULT_TTL_SECONDS = 3600; // 1 hour
  private static readonly MAX_RECENT_DIRECTORIES = 10;

  constructor() {
    this.cacheDir = path.join(config.paths.userDataDir, 'cache', 'projects');
    this.globalMetadataPath = path.join(this.cacheDir, 'global-metadata.json');
  }

  /**
   * Initialize cache directory structure
   */
  async initialize(): Promise<void> {
    try {
      // Set restrictive directory permissions (owner read/write/execute only)
      await fs.mkdir(this.cacheDir, { recursive: true, mode: 0o700 });
    } catch (error) {
      logger.error('Failed to initialize file cache manager:', error);
      throw error;
    }
  }

  /**
   * Encode directory path for cache directory name
   * Claude projects style: / -> -
   * Example: /Users/nkmr/ghq -> -Users-nkmr-ghq
   */
  encodeDirectoryPath(directory: string): string {
    return directory.replace(/\//g, '-');
  }

  /**
   * Get cache directory path for a specific directory
   */
  getCachePath(directory: string): string {
    const encoded = this.encodeDirectoryPath(directory);
    return path.join(this.cacheDir, encoded);
  }

  /**
   * Load cache for a directory (returns immediately if exists)
   * Returns null if cache doesn't exist or is invalid
   * @param directory - Directory path to load cache for
   * @param options.withRecentMtimes - If true, merge recent mtime data for scoring (for window show)
   */
  async loadCache(
    directory: string,
    options?: { withRecentMtimes?: boolean }
  ): Promise<CachedDirectoryData | null> {
    try {
      const cachePath = this.getCachePath(directory);
      const metadataPath = path.join(cachePath, 'metadata.json');
      const filesPath = path.join(cachePath, 'files.jsonl');

      // Check if both metadata and files exist
      try {
        await fs.access(metadataPath);
        await fs.access(filesPath);
      } catch {
        return null;
      }

      // Read metadata
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent) as FileCacheMetadata;

      // Read files from JSONL
      const entries = await this.readJsonlFile(filesPath);
      let files = entries.map(entry => this.cacheEntryToFileInfo(entry));

      // Merge recent mtime data if requested (for window show scoring)
      if (options?.withRecentMtimes) {
        files = await this.mergeRecentMtimes(directory, files);
      }

      return {
        directory,
        files,
        metadata
      };
    } catch (error) {
      logger.error('Failed to load cache:', error);
      return null;
    }
  }

  // ============================================================================
  // Recent Mtime Management (top 100 recently modified files)
  // ============================================================================

  private static readonly MAX_RECENT_FILES = 100;
  private static readonly RECENT_MTIMES_FILE = 'recent-mtimes.json';

  /**
   * Merge recent mtime data into file list for scoring
   * Only the top 100 recently modified files get mtime bonus
   */
  private async mergeRecentMtimes(directory: string, files: FileInfo[]): Promise<FileInfo[]> {
    try {
      // Load and refresh recent mtimes
      const recentMtimes = await this.refreshRecentMtimes(directory);
      if (!recentMtimes || recentMtimes.size === 0) {
        return files;
      }

      // Merge mtime data into file list
      return files.map(file => {
        const mtimeMs = recentMtimes.get(file.path);
        if (mtimeMs !== undefined) {
          return { ...file, mtimeMs };
        }
        return file;
      });
    } catch (error) {
      logger.warn('Failed to merge recent mtimes:', error);
      return files;
    }
  }

  /**
   * Refresh mtime for recent files and save back to cache
   * Returns Map<path, mtimeMs> for the top 100 recently modified files
   */
  async refreshRecentMtimes(directory: string): Promise<Map<string, number> | null> {
    const cachePath = this.getCachePath(directory);
    const recentMtimesPath = path.join(cachePath, FileCacheManager.RECENT_MTIMES_FILE);

    try {
      // Load existing recent files list
      let recentPaths: string[];
      try {
        const content = await fs.readFile(recentMtimesPath, 'utf8');
        const data = JSON.parse(content) as { files: Array<{ path: string }> };
        recentPaths = data.files.map(f => f.path);
      } catch {
        // No recent files cache yet, return null
        return null;
      }

      // Refresh mtime for these files (only 100 fs.stat calls)
      const mtimeMap = new Map<string, number>();
      const refreshedFiles: Array<{ path: string; mtimeMs: number }> = [];

      await Promise.all(
        recentPaths.map(async (filePath) => {
          try {
            const stats = await fs.stat(filePath);
            mtimeMap.set(filePath, stats.mtimeMs);
            refreshedFiles.push({ path: filePath, mtimeMs: stats.mtimeMs });
          } catch {
            // File may have been deleted, skip it
          }
        })
      );

      // Re-sort by mtime and save back (in case files were deleted or order changed)
      refreshedFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
      await fs.writeFile(
        recentMtimesPath,
        JSON.stringify({ files: refreshedFiles.slice(0, FileCacheManager.MAX_RECENT_FILES) }, null, 2),
        { mode: 0o600 }
      );

      return mtimeMap;
    } catch (error) {
      logger.warn('Failed to refresh recent mtimes:', error);
      return null;
    }
  }

  /**
   * Build recent mtimes cache by scanning all files for mtime
   * Called when saving cache (background operation)
   */
  async buildRecentMtimes(directory: string, files: FileInfo[]): Promise<void> {
    const cachePath = this.getCachePath(directory);
    const recentMtimesPath = path.join(cachePath, FileCacheManager.RECENT_MTIMES_FILE);

    try {
      // Get mtime for all files (batch fs.stat)
      const filesWithMtime: Array<{ path: string; mtimeMs: number }> = [];
      const BATCH_SIZE = 200;

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (file) => {
            try {
              const stats = await fs.stat(file.path);
              return { path: file.path, mtimeMs: stats.mtimeMs };
            } catch {
              return null;
            }
          })
        );
        filesWithMtime.push(...results.filter((r): r is { path: string; mtimeMs: number } => r !== null));
      }

      // Sort by mtime descending and take top 100
      filesWithMtime.sort((a, b) => b.mtimeMs - a.mtimeMs);
      const recentFiles = filesWithMtime.slice(0, FileCacheManager.MAX_RECENT_FILES);

      // Save to cache
      await fs.writeFile(
        recentMtimesPath,
        JSON.stringify({ files: recentFiles }, null, 2),
        { mode: 0o600 }
      );

      logger.debug(`Built recent mtimes cache: ${recentFiles.length} files for ${directory}`);
    } catch (error) {
      logger.warn('Failed to build recent mtimes:', error);
    }
  }

  /**
   * Save cache for a directory (background operation)
   * This should be called asynchronously after file search completes
   */
  async saveCache(
    directory: string,
    files: FileInfo[],
    options?: {
      searchMode?: 'recursive';
      gitignoreRespected?: boolean;
    }
  ): Promise<void> {
    try {
      const cachePath = this.getCachePath(directory);
      const metadataPath = path.join(cachePath, 'metadata.json');
      const filesPath = path.join(cachePath, 'files.jsonl');

      // Create cache directory with restrictive permissions (owner read/write/execute only)
      await fs.mkdir(cachePath, { recursive: true, mode: 0o700 });

      // Prepare metadata
      const now = new Date().toISOString();
      const metadata: FileCacheMetadata = {
        version: FileCacheManager.CACHE_VERSION,
        directory,
        createdAt: now,
        updatedAt: now,
        fileCount: files.length,
        ttlSeconds: FileCacheManager.DEFAULT_TTL_SECONDS,
        searchMode: 'recursive',  // Always recursive (fd is required)
        ...(options?.gitignoreRespected !== undefined && {
          gitignoreRespected: options.gitignoreRespected
        })
      };

      // Write metadata with restrictive file permissions (owner read/write only)
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });

      // Convert files to cache entries and write JSONL (without mtime - saves space)
      const entries = files.map(file => this.fileInfoToCacheEntry(file));
      await this.writeJsonlFile(filesPath, entries);

      // Build recent mtimes cache in background (top 100 recently modified files)
      // This runs in background to not block the main cache save
      this.buildRecentMtimes(directory, files).catch(err => {
        logger.warn('Failed to build recent mtimes in background:', err);
      });

      // Update global metadata
      await this.setLastUsedDirectory(directory);
    } catch (error) {
      logger.error('Failed to save cache:', error);
      // Don't throw - cache save failure shouldn't break file search
    }
  }

  /**
   * Check if cache is valid (within TTL)
   * Returns false if:
   * - Cache is older than TTL
   * - Cache has fileCount of 0 (indicates failed indexing, should re-index)
   */
  isCacheValid(metadata: FileCacheMetadata, ttlSeconds?: number): boolean {
    // Invalidate cache if fileCount is 0 (indicates failed indexing)
    if (metadata.fileCount === 0) {
      return false;
    }

    const ttl = ttlSeconds ?? metadata.ttlSeconds ?? FileCacheManager.DEFAULT_TTL_SECONDS;
    const updatedAt = new Date(metadata.updatedAt).getTime();
    const now = Date.now();
    const ageMs = now - updatedAt;

    return ageMs < ttl * 1000;
  }

  /**
   * Update cache timestamp only (when no file changes detected)
   * This extends the cache TTL without rewriting files
   */
  async updateCacheTimestamp(directory: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(directory);
      const metadataPath = path.join(cachePath, 'metadata.json');

      // Read existing metadata
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent) as FileCacheMetadata;

      // Update only the updatedAt field
      metadata.updatedAt = new Date().toISOString();

      // Write back with restrictive file permissions (owner read/write only)
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
    } catch (error) {
      logger.error('Failed to update cache timestamp:', error);
      // Don't throw - timestamp update failure shouldn't break operations
    }
  }

  /**
   * Get last used directory from global metadata
   */
  async getLastUsedDirectory(): Promise<string | null> {
    try {
      const content = await fs.readFile(this.globalMetadataPath, 'utf8');
      const metadata = JSON.parse(content) as GlobalCacheMetadata;
      return metadata.lastUsedDirectory;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error('Failed to read global metadata:', error);
      return null;
    }
  }

  /**
   * Set last used directory in global metadata
   */
  async setLastUsedDirectory(directory: string): Promise<void> {
    try {
      let metadata: GlobalCacheMetadata;

      try {
        const content = await fs.readFile(this.globalMetadataPath, 'utf8');
        metadata = JSON.parse(content) as GlobalCacheMetadata;
      } catch {
        // Create new metadata if not exists
        metadata = {
          version: FileCacheManager.CACHE_VERSION,
          lastUsedDirectory: null,
          lastUsedAt: null,
          recentDirectories: []
        };
      }

      const now = new Date().toISOString();

      // Update last used
      metadata.lastUsedDirectory = directory;
      metadata.lastUsedAt = now;

      // Update recent directories list
      // Remove if already exists
      metadata.recentDirectories = metadata.recentDirectories.filter(
        item => item.directory !== directory
      );

      // Add to front
      metadata.recentDirectories.unshift({
        directory,
        lastUsedAt: now
      });

      // Limit to MAX_RECENT_DIRECTORIES
      metadata.recentDirectories = metadata.recentDirectories.slice(
        0,
        FileCacheManager.MAX_RECENT_DIRECTORIES
      );

      // Write back
      await fs.writeFile(
        this.globalMetadataPath,
        JSON.stringify(metadata, null, 2)
      );
    } catch (error) {
      logger.error('Failed to update global metadata:', error);
      // Don't throw - metadata update failure shouldn't break operations
    }
  }

  /**
   * Clear cache for a specific directory
   */
  async clearCache(directory: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(directory);

      // Remove cache directory recursively
      await fs.rm(cachePath, { recursive: true, force: true });

      logger.info(`Cleared cache for directory: ${directory}`);
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    try {
      // Read all cache directories
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });

      // Remove all directories except global-metadata.json
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const cachePath = path.join(this.cacheDir, entry.name);
          await fs.rm(cachePath, { recursive: true, force: true });
        }
      }

      // Also remove global metadata
      await fs.rm(this.globalMetadataPath, { force: true });

      logger.info('Cleared all caches');
    } catch (error) {
      logger.error('Failed to clear all caches:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<FileCacheStats> {
    try {
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });

      let totalCaches = 0;
      let totalFiles = 0;
      let oldestCache: string | null = null;
      let newestCache: string | null = null;
      let totalSizeBytes = 0;
      let oldestTimestamp = Number.MAX_SAFE_INTEGER;
      let newestTimestamp = 0;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const metadataPath = path.join(this.cacheDir, entry.name, 'metadata.json');

        try {
          const content = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(content) as FileCacheMetadata;

          totalCaches++;
          totalFiles += metadata.fileCount;

          const timestamp = new Date(metadata.updatedAt).getTime();
          if (timestamp < oldestTimestamp) {
            oldestTimestamp = timestamp;
            oldestCache = metadata.directory;
          }
          if (timestamp > newestTimestamp) {
            newestTimestamp = timestamp;
            newestCache = metadata.directory;
          }

          // Calculate directory size
          const filesPath = path.join(this.cacheDir, entry.name, 'files.jsonl');
          const stats = await fs.stat(filesPath);
          totalSizeBytes += stats.size;
        } catch {
          // Skip invalid cache entries
          continue;
        }
      }

      return {
        totalCaches,
        totalFiles,
        oldestCache,
        newestCache,
        totalSizeBytes
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        totalCaches: 0,
        totalFiles: 0,
        oldestCache: null,
        newestCache: null,
        totalSizeBytes: 0
      };
    }
  }

  /**
   * Cleanup old caches (for periodic maintenance)
   * Removes caches older than maxAgeDays
   */
  async cleanupOldCaches(maxAgeDays: number): Promise<void> {
    try {
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });
      const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
      const now = Date.now();
      let removedCount = 0;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const metadataPath = path.join(this.cacheDir, entry.name, 'metadata.json');

        try {
          const content = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(content) as FileCacheMetadata;

          const timestamp = new Date(metadata.updatedAt).getTime();
          const age = now - timestamp;

          if (age > maxAgeMs) {
            const cachePath = path.join(this.cacheDir, entry.name);
            await fs.rm(cachePath, { recursive: true, force: true });
            removedCount++;
          }
        } catch {
          // Skip invalid cache entries
          continue;
        }
      }

      logger.info(`Cleanup completed: removed ${removedCount} old caches`);
    } catch (error) {
      logger.error('Failed to cleanup old caches:', error);
      throw error;
    }
  }

  /**
   * Convert FileInfo to CachedFileEntry for storage
   * Uses compact format to reduce file size
   */
  private fileInfoToCacheEntry(file: FileInfo): CachedFileEntry {
    const entry: CachedFileEntry = {
      path: file.path,
      name: file.name,
      type: file.isDirectory ? 'directory' : 'file'
    };

    if (file.size !== undefined) {
      entry.size = file.size;
    }

    // Prefer mtimeMs (number) over modifiedAt (string) to avoid parsing
    if (file.mtimeMs !== undefined) {
      entry.mtime = file.mtimeMs;
    } else if (file.modifiedAt) {
      entry.mtime = new Date(file.modifiedAt).getTime();
    }

    return entry;
  }

  /**
   * Convert CachedFileEntry to FileInfo for use
   */
  private cacheEntryToFileInfo(entry: CachedFileEntry): FileInfo {
    const fileInfo: FileInfo = {
      path: entry.path,
      name: entry.name,
      isDirectory: entry.type === 'directory'
    };

    if (entry.size !== undefined) {
      fileInfo.size = entry.size;
    }

    if (entry.mtime !== undefined) {
      fileInfo.modifiedAt = new Date(entry.mtime).toISOString();
      fileInfo.mtimeMs = entry.mtime;
    }

    return fileInfo;
  }

  /**
   * Read JSONL file as stream for memory efficiency
   */
  private async readJsonlFile(filePath: string): Promise<CachedFileEntry[]> {
    return new Promise((resolve, reject) => {
      const entries: CachedFileEntry[] = [];
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        try {
          if (line.trim()) {
            const entry = JSON.parse(line) as CachedFileEntry;
            entries.push(entry);
          }
        } catch {
          logger.warn('Invalid JSONL line in cache file:', line);
        }
      });

      rl.on('close', () => {
        resolve(entries);
      });

      rl.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Write JSONL file as stream for memory efficiency
   */
  private async writeJsonlFile(
    filePath: string,
    entries: CachedFileEntry[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Set restrictive file permissions (owner read/write only)
      const writeStream = createWriteStream(filePath, { mode: 0o600 });

      writeStream.on('error', reject);
      writeStream.on('finish', resolve);

      for (const entry of entries) {
        writeStream.write(JSON.stringify(entry) + '\n');
      }

      writeStream.end();
    });
  }
}

export default FileCacheManager;
