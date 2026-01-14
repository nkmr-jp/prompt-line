import path from 'path';
import { UsageHistoryManager } from './usage-history-manager';

/**
 * File Usage History Manager
 * Manages usage history for @ mention file selections
 */
class FileUsageHistoryManager extends UsageHistoryManager {
  private static instance: FileUsageHistoryManager | null = null;

  private constructor() {
    // Lazy initialization - get config when first used
    const config = require('../config/app-config').default;
    const filePath = path.join(config.paths.projectsCacheDir, 'file-usage-history.jsonl');
    super(filePath, {
      maxEntries: 500,
      ttlDays: 30,
    });
  }

  static getInstance(): FileUsageHistoryManager {
    if (!FileUsageHistoryManager.instance) {
      FileUsageHistoryManager.instance = new FileUsageHistoryManager();
    }
    return FileUsageHistoryManager.instance;
  }

  /**
   * Normalize file path for consistent key storage
   * Removes leading/trailing slashes and normalizes separators
   */
  normalizeKey(filePath: string): string {
    return path.normalize(filePath).replace(/^\/+|\/+$/g, '');
  }

  /**
   * Record file usage with normalized path
   */
  async recordFileUsage(filePath: string): Promise<void> {
    const key = this.normalizeKey(filePath);
    await this.recordUsage(key);
  }

  /**
   * Calculate bonus for a file path
   */
  calculateFileBonus(filePath: string): number {
    const key = this.normalizeKey(filePath);
    return this.calculateBonus(key);
  }
}

export const fileUsageHistoryManager = FileUsageHistoryManager.getInstance();
export { FileUsageHistoryManager };
