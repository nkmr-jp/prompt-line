import fs from 'fs/promises';
import path from 'path';
import { ensureDir } from '../utils/file-utils';
import { logger } from '../utils/logger';
import { calculateFrequencyBonus, calculateUsageRecencyBonus } from '../lib/usage-bonus-calculator';

const GLOBAL_CACHE_FILE_NAME = 'global-agent-skills.jsonl';
const MAX_ENTRIES = 100;

interface AgentSkillCacheEntry {
  name: string;
  count: number;
  lastUsed: number;
  firstUsed: number;
}

/**
 * Agent Skill Cache Manager for storing recently used agent skills
 * Used for quick access to frequently used skills
 */
export class AgentSkillCacheManager {
  private _cacheDir: string | null = null;

  /**
   * Get cache directory with lazy initialization
   */
  private get cacheDir(): string {
    if (this._cacheDir === null) {
       
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
   * Load global agent skill names (ordered by most recently used)
   */
  async loadGlobalSkills(): Promise<string[]> {
    try {
      const entries = await this.loadGlobalEntries();
      // Return in reverse order (most recent first)
      return entries.reverse().map(e => e.name);
    } catch {
      return [];
    }
  }

  /**
   * Add a skill to global cache (with 100 entry limit)
   * Updates count and lastUsed if entry exists, otherwise creates new entry
   */
  async addGlobalSkill(skillName: string): Promise<void> {
    try {
      await ensureDir(this.cacheDir);

      // Load existing entries
      const entries = await this.loadGlobalEntries();

      // Find existing entry
      const existingIndex = entries.findIndex(e => e.name === skillName);

      if (existingIndex >= 0) {
        // Update existing entry: increment count and update lastUsed
        const existingEntry = entries[existingIndex];
        if (existingEntry) {
          existingEntry.count++;
          existingEntry.lastUsed = Date.now();
        }
      } else {
        // Create new entry
        const now = Date.now();
        entries.push({
          name: skillName,
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
      logger.error('Error adding global agent skill:', error);
    }
  }

  /**
   * Load global entries (internal)
   * Handles backward compatibility with old format {name, timestamp}
   */
  private async loadGlobalEntries(): Promise<AgentSkillCacheEntry[]> {
    try {
      const filePath = this.getGlobalCacheFilePath();
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      const entries: AgentSkillCacheEntry[] = [];
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
      logger.warn('Error clearing global agent skill cache:', error);
    }
  }

  /**
   * Calculate bonus score for a skill (frequency + recency)
   * Used for sorting search results
   *
   * @param skillName - Agent skill name to calculate bonus for
   * @returns Total bonus score (0-150: frequency 0-100 + recency 0-50)
   */
  async calculateBonus(skillName: string): Promise<number> {
    try {
      // Load entries from cache
      const entries = await this.loadGlobalEntries();

      // Find entry for the command
      const entry = entries.find(e => e.name === skillName);

      if (!entry) {
        return 0;
      }

      // Calculate frequency bonus (0-100)
      const frequencyBonus = calculateFrequencyBonus(entry.count);

      // Calculate recency bonus (0-50)
      const recencyBonus = calculateUsageRecencyBonus(entry.lastUsed);

      return frequencyBonus + recencyBonus;
    } catch (error) {
      logger.warn('Error calculating agent skill bonus:', error);
      return 0;
    }
  }
}

export const agentSkillCacheManager = new AgentSkillCacheManager();
