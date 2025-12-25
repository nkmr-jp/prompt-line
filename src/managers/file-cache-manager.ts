import { promises as fs } from 'fs';
import path from 'path';
import config from '../config/app-config';
import { logger } from '../utils/utils';
import type {
  FileInfo,
  FileCacheMetadata,
  CachedDirectoryData,
  GlobalCacheMetadata,
  FileCacheStats
} from '../types';
import {
  encodeDirectoryPath,
  fileInfoToCacheEntry,
  cacheEntryToFileInfo,
  readJsonlFile,
  writeJsonlFile,
  buildStatsResult,
  buildEmptyStatsResult,
  getCacheFilePaths,
  cacheFilesExist,
  readCacheMetadata,
  createDefaultGlobalMetadata,
  updateMetadataWithDirectory as updateMetadataHelper,
  saveGlobalMetadata,
  initializeStats,
  processEntryStats,
  shouldRemoveCacheEntry,
  createCacheMetadata
} from './file-cache-helpers';

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
      logger.debug('File cache manager initialized');
    } catch (error) {
      logger.error('Failed to initialize file cache manager:', error);
      throw error;
    }
  }

  /**
   * Get cache directory path for a specific directory
   */
  getCachePath(directory: string): string {
    const encoded = encodeDirectoryPath(directory);
    return path.join(this.cacheDir, encoded);
  }

  /**
   * Load cache for a directory (returns immediately if exists)
   * Returns null if cache doesn't exist or is invalid
   */
  async loadCache(directory: string): Promise<CachedDirectoryData | null> {
    try {
      const cachePath = this.getCachePath(directory);
      const paths = getCacheFilePaths(cachePath);

      if (!await cacheFilesExist(paths)) {
        logger.debug('Cache not found for directory:', directory);
        return null;
      }

      const metadata = await readCacheMetadata(paths.metadataPath);
      const files = await this.readCacheFiles(paths.filesPath);

      logger.debug(`Loaded cache for directory: ${directory} (${files.length} files)`);

      return { directory, files, metadata };
    } catch (error) {
      logger.error('Failed to load cache:', error);
      return null;
    }
  }

  private async readCacheFiles(filesPath: string): Promise<FileInfo[]> {
    const entries = await readJsonlFile(filesPath);
    return entries.map(entry => cacheEntryToFileInfo(entry));
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

      await fs.mkdir(cachePath, { recursive: true, mode: 0o700 });

      const metadata = createCacheMetadata(
        directory,
        files.length,
        FileCacheManager.CACHE_VERSION,
        FileCacheManager.DEFAULT_TTL_SECONDS,
        options
      );

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });

      const entries = files.map(file => fileInfoToCacheEntry(file));
      await writeJsonlFile(filesPath, entries);
      await this.setLastUsedDirectory(directory);

      logger.debug(`Saved cache for directory: ${directory} (${files.length} files)`);
    } catch (error) {
      logger.error('Failed to save cache:', error);
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
      logger.debug('Cache invalid: fileCount is 0 (will re-index)');
      return false;
    }

    const ttl = ttlSeconds ?? metadata.ttlSeconds ?? FileCacheManager.DEFAULT_TTL_SECONDS;
    const updatedAt = new Date(metadata.updatedAt).getTime();
    const now = Date.now();
    const ageMs = now - updatedAt;
    const isValid = ageMs < ttl * 1000;

    logger.debug(`Cache validity check: age=${ageMs}ms, ttl=${ttl}s, valid=${isValid}, fileCount=${metadata.fileCount}`);

    return isValid;
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

      logger.debug(`Updated cache timestamp for directory: ${directory}`);
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
        logger.debug('Global metadata not found');
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
      const metadata = await this.loadOrCreateGlobalMetadata();
      const now = new Date().toISOString();

      updateMetadataHelper(metadata, directory, now, FileCacheManager.MAX_RECENT_DIRECTORIES);
      await saveGlobalMetadata(this.globalMetadataPath, metadata);

      logger.debug(`Updated global metadata with directory: ${directory}`);
    } catch (error) {
      logger.error('Failed to update global metadata:', error);
      // Don't throw - metadata update failure shouldn't break operations
    }
  }

  private async loadOrCreateGlobalMetadata(): Promise<GlobalCacheMetadata> {
    try {
      const content = await fs.readFile(this.globalMetadataPath, 'utf8');
      return JSON.parse(content) as GlobalCacheMetadata;
    } catch {
      return createDefaultGlobalMetadata(FileCacheManager.CACHE_VERSION);
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
      const stats = initializeStats();

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        await processEntryStats(this.cacheDir, entry, stats);
      }

      return buildStatsResult(stats);
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return buildEmptyStatsResult();
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

        const result = await shouldRemoveCacheEntry(this.cacheDir, entry.name, maxAgeMs, now);
        if (result.shouldRemove) {
          const cachePath = path.join(this.cacheDir, entry.name);
          await fs.rm(cachePath, { recursive: true, force: true });
          logger.debug(`Removed old cache: ${result.directory}`);
          removedCount++;
        }
      }

      logger.info(`Cleanup completed: removed ${removedCount} old caches`);
    } catch (error) {
      logger.error('Failed to cleanup old caches:', error);
      throw error;
    }
  }
}

export default FileCacheManager;
