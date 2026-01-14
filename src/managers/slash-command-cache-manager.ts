import fs from 'fs/promises';
import path from 'path';
import { ensureDir } from '../utils/file-utils';
import { logger } from '../utils/logger';
import { calculateFrequencyBonus, calculateUsageRecencyBonus } from '../lib/usage-bonus-calculator';

const GLOBAL_CACHE_FILE_NAME = 'global-slash-commands.jsonl';
const MAX_ENTRIES = 100;

interface SlashCommandCacheEntry {
  name: string;
  count: number;
  lastUsed: number;
  firstUsed: number;
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
   * Updates count and lastUsed if entry exists, otherwise creates new entry
   */
  async addGlobalCommand(commandName: string): Promise<void> {
    try {
      await ensureDir(this.cacheDir);

      // Load existing entries
      const entries = await this.loadGlobalEntries();

      // Find existing entry
      const existingIndex = entries.findIndex(e => e.name === commandName);

      if (existingIndex >= 0) {
        // Update existing entry: increment count and update lastUsed
        entries[existingIndex].count++;
        entries[existingIndex].lastUsed = Date.now();
      } else {
        // Create new entry
        const now = Date.now();
        entries.push({
          name: commandName,
          count: 1,
          lastUsed: now,
          firstUsed: now,
        });

        // Remove oldest entry if exceeding limit
        if (entries.length > MAX_ENTRIES) {
          entries.shift();
        }
      }

      // Save
      const content = entries.map(e => JSON.stringify(e)).join('\n');
      await fs.writeFile(this.getGlobalCacheFilePath(), content, 'utf8');
    } catch (error) {
      logger.error('Error adding global slash command:', error);
    }
  }

  /**
   * Load global entries (internal)
   * Handles backward compatibility with old format {name, timestamp}
   */
  private async loadGlobalEntries(): Promise<SlashCommandCacheEntry[]> {
    try {
      const filePath = this.getGlobalCacheFilePath();
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      const entries: SlashCommandCacheEntry[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);

          // Backward compatibility: convert old format to new format
          if ('timestamp' in parsed && !('count' in parsed)) {
            // Old format: {name, timestamp} -> new format: {name, count, lastUsed, firstUsed}
            entries.push({
              name: parsed.name,
              count: 1,
              lastUsed: parsed.timestamp,
              firstUsed: parsed.timestamp,
            });
          } else {
            // New format already
            entries.push(parsed);
          }
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

  /**
   * Calculate bonus score for a command (frequency + recency)
   * Used for sorting search results
   *
   * @param commandName - Slash command name to calculate bonus for
   * @returns Total bonus score (0-150: frequency 0-100 + recency 0-50)
   */
  async calculateBonus(commandName: string): Promise<number> {
    try {
      // Load entries from cache
      const entries = await this.loadGlobalEntries();

      // Find entry for the command
      const entry = entries.find(e => e.name === commandName);

      if (!entry) {
        return 0;
      }

      // Calculate frequency bonus (0-100)
      const frequencyBonus = calculateFrequencyBonus(entry.count);

      // Calculate recency bonus (0-50)
      const recencyBonus = calculateUsageRecencyBonus(entry.lastUsed);

      return frequencyBonus + recencyBonus;
    } catch (error) {
      logger.warn('Error calculating slash command bonus:', error);
      return 0;
    }
  }
}

export const slashCommandCacheManager = new SlashCommandCacheManager();
