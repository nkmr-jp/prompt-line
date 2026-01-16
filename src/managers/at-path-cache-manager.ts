import fs from 'fs/promises';
import path from 'path';
import { ensureDir } from '../utils/file-utils';
import { logger } from '../utils/logger';

const CACHE_FILE_NAME = 'registered-at-paths.jsonl';
const GLOBAL_CACHE_FILE_NAME = 'global-at-paths.jsonl';
const MAX_ENTRIES = 100;

interface AtPathEntry {
  path: string;
  timestamp: number;
}

/**
 * At-path Cache Manager for storing registered @path patterns per project
 * Used for highlighting symbols with spaces in their names
 */
export class AtPathCacheManager {
  private _cacheDir: string | null = null;

  /**
   * Get cache directory with lazy initialization
   * This pattern prevents issues during module loading in test environments
   */
  private get cacheDir(): string {
    if (this._cacheDir === null) {
      // Lazy import to avoid issues during module loading
       
      const config = require('../config/app-config').default;
      this._cacheDir = config.paths.projectsCacheDir as string;
    }
    return this._cacheDir as string;
  }

  /**
   * Encode directory path to safe cache directory name
   */
  private encodePath(directoryPath: string): string {
    return directoryPath.replace(/\//g, '-');
  }

  /**
   * Get cache directory for a project
   */
  private getProjectCacheDir(directory: string): string {
    const encodedPath = this.encodePath(directory);
    return path.join(this.cacheDir, encodedPath);
  }

  /**
   * Get cache file path for a project
   */
  private getCacheFilePath(directory: string): string {
    return path.join(this.getProjectCacheDir(directory), CACHE_FILE_NAME);
  }

  /**
   * Load registered paths for a directory
   */
  async loadPaths(directory: string): Promise<string[]> {
    try {
      const entries = await this.loadEntries(directory);
      return entries.map(e => e.path);
    } catch {
      return [];
    }
  }

  /**
   * Add a path (with 100 entry limit)
   */
  async addPath(directory: string, atPath: string): Promise<void> {
    try {
      const projectCacheDir = this.getProjectCacheDir(directory);
      await ensureDir(projectCacheDir);

      // Load existing entries
      const entries = await this.loadEntries(directory);

      // Remove duplicates
      const filtered = entries.filter(e => e.path !== atPath);

      // Add new entry
      filtered.push({ path: atPath, timestamp: Date.now() });

      // Remove old entries if exceeding limit
      while (filtered.length > MAX_ENTRIES) {
        filtered.shift();
      }

      // Save
      const content = filtered.map(e => JSON.stringify(e)).join('\n');
      await fs.writeFile(this.getCacheFilePath(directory), content, 'utf8');
    } catch (error) {
      logger.error('Error adding at-path:', error);
    }
  }

  /**
   * Load entries (internal)
   */
  private async loadEntries(directory: string): Promise<AtPathEntry[]> {
    try {
      const filePath = this.getCacheFilePath(directory);
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      const entries: AtPathEntry[] = [];
      for (const line of lines) {
        try {
          const entry: AtPathEntry = JSON.parse(line);
          entries.push(entry);
        } catch {
          // Skip invalid lines
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  /**
   * Clear cache for a directory
   */
  async clearCache(directory: string): Promise<void> {
    try {
      const filePath = this.getCacheFilePath(directory);
      await fs.rm(filePath, { force: true });
    } catch (error) {
      logger.warn('Error clearing at-path cache:', error);
    }
  }

  // ============================================================================
  // Global Cache Methods (for mdSearch agents and other project-independent items)
  // ============================================================================

  /**
   * Get global cache file path
   */
  private getGlobalCacheFilePath(): string {
    return path.join(this.cacheDir, GLOBAL_CACHE_FILE_NAME);
  }

  /**
   * Load global registered paths (project-independent)
   */
  async loadGlobalPaths(): Promise<string[]> {
    try {
      const entries = await this.loadGlobalEntries();
      return entries.map(e => e.path);
    } catch {
      return [];
    }
  }

  /**
   * Add a path to global cache (with 100 entry limit)
   */
  async addGlobalPath(atPath: string): Promise<void> {
    try {
      await ensureDir(this.cacheDir);

      // Load existing entries
      const entries = await this.loadGlobalEntries();

      // Remove duplicates
      const filtered = entries.filter(e => e.path !== atPath);

      // Add new entry
      filtered.push({ path: atPath, timestamp: Date.now() });

      // Remove old entries if exceeding limit
      while (filtered.length > MAX_ENTRIES) {
        filtered.shift();
      }

      // Save
      const content = filtered.map(e => JSON.stringify(e)).join('\n');
      await fs.writeFile(this.getGlobalCacheFilePath(), content, 'utf8');
    } catch (error) {
      logger.error('Error adding global at-path:', error);
    }
  }

  /**
   * Load global entries (internal)
   */
  private async loadGlobalEntries(): Promise<AtPathEntry[]> {
    try {
      const filePath = this.getGlobalCacheFilePath();
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      const entries: AtPathEntry[] = [];
      for (const line of lines) {
        try {
          const entry: AtPathEntry = JSON.parse(line);
          entries.push(entry);
        } catch {
          // Skip invalid lines
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  /**
   * Clear global cache
   */
  async clearGlobalCache(): Promise<void> {
    try {
      const filePath = this.getGlobalCacheFilePath();
      await fs.rm(filePath, { force: true });
    } catch (error) {
      logger.warn('Error clearing global at-path cache:', error);
    }
  }
}

export const atPathCacheManager = new AtPathCacheManager();
