import fs from 'fs/promises';
import path from 'path';
import { ensureDir } from '../utils/file-utils';
import { logger } from '../utils/logger';
import { calculateFrequencyBonus, calculateUsageRecencyBonus } from '../lib/usage-bonus-calculator';

/**
 * Single usage entry
 */
interface UsageEntry {
  key: string;          // Unique identifier for the item
  count: number;        // Usage count
  lastUsed: number;     // Last used timestamp (ms)
  firstUsed: number;    // First used timestamp (ms)
}

/**
 * Configuration for usage history
 */
interface UsageHistoryConfig {
  maxEntries: number;   // Maximum number of entries (default: 500)
  ttlDays: number;      // TTL in days (default: 30)
}

/**
 * UsageHistoryManager
 *
 * Manages usage history for slash commands, files, symbols, and agents.
 * Tracks usage frequency and recency to calculate bonus scores.
 *
 * Features:
 * - JSONL file format for efficient append operations
 * - Lazy initialization with in-memory cache
 * - TTL-based and count-based pruning
 * - Frequency and recency bonus calculation
 */
export class UsageHistoryManager {
  private filePath: string;
  private maxEntries: number;
  private ttlDays: number;
  private cache: Map<string, UsageEntry> = new Map();
  private initialized = false;

  constructor(filePath: string, config?: Partial<UsageHistoryConfig>) {
    this.filePath = filePath;
    this.maxEntries = config?.maxEntries ?? 500;
    this.ttlDays = config?.ttlDays ?? 30;
  }

  /**
   * Initialize - load entries from file into cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadEntries();
      this.initialized = true;
      logger.debug('UsageHistoryManager initialized', {
        filePath: this.filePath,
        entryCount: this.cache.size,
      });
    } catch (error) {
      logger.error('Failed to initialize UsageHistoryManager', { error, filePath: this.filePath });
      throw error;
    }
  }

  /**
   * Record usage - increment count or create new entry
   */
  async recordUsage(key: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const now = Date.now();
    const existing = this.cache.get(key);

    if (existing) {
      existing.count++;
      existing.lastUsed = now;
    } else {
      this.cache.set(key, {
        key,
        count: 1,
        lastUsed: now,
        firstUsed: now,
      });
    }

    // Prune before save to keep cache size under control
    this.pruneOldEntries();

    await this.saveEntries();
  }

  /**
   * Calculate bonus score (frequency + recency)
   */
  calculateBonus(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) {
      return 0;
    }

    const frequencyBonus = calculateFrequencyBonus(entry.count);
    const recencyBonus = calculateUsageRecencyBonus(entry.lastUsed);

    return frequencyBonus + recencyBonus;
  }

  /**
   * Get single entry
   */
  getEntry(key: string): UsageEntry | undefined {
    return this.cache.get(key);
  }

  /**
   * Get all entries
   */
  getAllEntries(): UsageEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Clear cache (remove all entries)
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    await this.saveEntries();
    logger.debug('Usage history cache cleared', { filePath: this.filePath });
  }

  /**
   * Load entries from JSONL file
   */
  private async loadEntries(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const lines = content.trim().split('\n').filter((line) => line.length > 0);

      for (const line of lines) {
        try {
          const entry: UsageEntry = JSON.parse(line);
          this.cache.set(entry.key, entry);
        } catch {
          // Skip invalid lines
        }
      }

      // Prune old entries after loading
      this.pruneOldEntries();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet - not an error
        logger.debug('Usage history file does not exist yet', { filePath: this.filePath });
        return;
      }
      throw error;
    }
  }

  /**
   * Save entries to JSONL file
   */
  private async saveEntries(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await ensureDir(dir);

      const lines = Array.from(this.cache.values()).map((entry) => JSON.stringify(entry));
      const content = lines.join('\n');

      await fs.writeFile(this.filePath, content, 'utf8');
    } catch (error) {
      logger.error('Failed to save usage history', { error, filePath: this.filePath });
      throw error;
    }
  }

  /**
   * Prune old entries based on TTL and max entry count
   */
  private pruneOldEntries(): void {
    const now = Date.now();
    const ttlMs = this.ttlDays * 24 * 60 * 60 * 1000;

    // Remove entries older than TTL
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastUsed > ttlMs) {
        this.cache.delete(key);
      }
    }

    // Remove oldest entries if exceeding maxEntries
    if (this.cache.size > this.maxEntries) {
      const sorted = Array.from(this.cache.values()).sort((a, b) => a.lastUsed - b.lastUsed);
      const toRemove = sorted.slice(0, this.cache.size - this.maxEntries);
      for (const entry of toRemove) {
        this.cache.delete(entry.key);
      }
    }
  }
}

export { UsageEntry, UsageHistoryConfig };
