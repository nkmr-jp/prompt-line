import fs from 'fs/promises';
import path from 'path';
import { ensureDir } from '../utils/file-utils';
import { logger } from '../utils/logger';

const GLOBAL_CACHE_FILE_NAME = 'global-slash-commands.jsonl';
const MAX_ENTRIES = 100;

interface SlashCommandEntry {
  name: string;
  timestamp: number;
}

/**
 * Slash Command Cache Manager for storing recently used slash commands
 * Used for quick access to frequently used commands
 */
export class SlashCommandCacheManager {
  private _cacheDir: string | null = null;

  /**
   * Get cache directory with lazy initialization
   */
  private get cacheDir(): string {
    if (this._cacheDir === null) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require('../config/app-config').default;
      this._cacheDir = config.paths.projectsCacheDir as string;
    }
    return this._cacheDir as string;
  }

  /**
   * Get global cache file path
   */
  private getGlobalCacheFilePath(): string {
    return path.join(this.cacheDir, GLOBAL_CACHE_FILE_NAME);
  }

  /**
   * Load global slash command names (ordered by most recently used)
   */
  async loadGlobalCommands(): Promise<string[]> {
    try {
      const entries = await this.loadGlobalEntries();
      // Return in reverse order (most recent first)
      return entries.reverse().map(e => e.name);
    } catch {
      return [];
    }
  }

  /**
   * Add a command to global cache (with 100 entry limit)
   */
  async addGlobalCommand(commandName: string): Promise<void> {
    try {
      await ensureDir(this.cacheDir);

      // Load existing entries
      const entries = await this.loadGlobalEntries();

      // Remove duplicates
      const filtered = entries.filter(e => e.name !== commandName);

      // Add new entry
      filtered.push({ name: commandName, timestamp: Date.now() });

      // Remove old entries if exceeding limit
      while (filtered.length > MAX_ENTRIES) {
        filtered.shift();
      }

      // Save
      const content = filtered.map(e => JSON.stringify(e)).join('\n');
      await fs.writeFile(this.getGlobalCacheFilePath(), content, 'utf8');
    } catch (error) {
      logger.error('Error adding global slash command:', error);
    }
  }

  /**
   * Load global entries (internal)
   */
  private async loadGlobalEntries(): Promise<SlashCommandEntry[]> {
    try {
      const filePath = this.getGlobalCacheFilePath();
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      const entries: SlashCommandEntry[] = [];
      for (const line of lines) {
        try {
          const entry: SlashCommandEntry = JSON.parse(line);
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
      logger.warn('Error clearing global slash command cache:', error);
    }
  }
}

export const slashCommandCacheManager = new SlashCommandCacheManager();
