import path from 'path';
import { UsageHistoryManager } from './usage-history-manager';
import config from '../config/app-config';

/**
 * Symbol Usage History Manager
 * Manages usage history for @lang:query symbol selections
 */
class SymbolUsageHistoryManager extends UsageHistoryManager {
  private static instance: SymbolUsageHistoryManager | null = null;

  private constructor() {
    const filePath = path.join(config.paths.projectsCacheDir, 'symbol-usage-history.jsonl');
    super(filePath, {
      maxEntries: 500,
      ttlDays: 30,
    });
  }

  static getInstance(): SymbolUsageHistoryManager {
    if (!SymbolUsageHistoryManager.instance) {
      SymbolUsageHistoryManager.instance = new SymbolUsageHistoryManager();
    }
    return SymbolUsageHistoryManager.instance;
  }

  /**
   * Create a unique key for a symbol
   * Format: {filePath}:{symbolName}
   */
  createSymbolKey(filePath: string, symbolName: string): string {
    return `${path.normalize(filePath)}:${symbolName}`;
  }

  /**
   * Record symbol usage
   */
  async recordSymbolUsage(filePath: string, symbolName: string): Promise<void> {
    const key = this.createSymbolKey(filePath, symbolName);
    await this.recordUsage(key);
  }

  /**
   * Calculate bonus for a symbol
   */
  calculateSymbolBonus(filePath: string, symbolName: string): number {
    const key = this.createSymbolKey(filePath, symbolName);
    return this.calculateBonus(key);
  }
}

export const symbolUsageHistoryManager = SymbolUsageHistoryManager.getInstance();
export { SymbolUsageHistoryManager };
