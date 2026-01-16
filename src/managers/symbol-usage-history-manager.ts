import path from 'path';
import { UsageHistoryManager } from './usage-history-manager';
import appConfig from '../config/app-config';

/**
 * Symbol Usage History Manager
 * Manages usage history for @lang:query symbol selections
 */
class SymbolUsageHistoryManager extends UsageHistoryManager {
  private static instance: SymbolUsageHistoryManager | null = null;
  private static _filePath: string | null = null;

  private static get filePath(): string {
    if (!SymbolUsageHistoryManager._filePath) {
      SymbolUsageHistoryManager._filePath = path.join(appConfig.paths.projectsCacheDir, 'symbol-usage-history.jsonl');
    }
    return SymbolUsageHistoryManager._filePath;
  }

  private constructor(filePath: string) {
    super(filePath, {
      maxEntries: 500,
      ttlDays: 30,
    });
  }

  static getInstance(): SymbolUsageHistoryManager {
    if (!SymbolUsageHistoryManager.instance) {
      SymbolUsageHistoryManager.instance = new SymbolUsageHistoryManager(SymbolUsageHistoryManager.filePath);
    }
    return SymbolUsageHistoryManager.instance;
  }

  /**
   * Create a unique key for a symbol
   * Format: {filePath}:{symbolName}
   */
  createSymbolKey(filePath: string, symbolName: string): string {
    const normalized = path.normalize(filePath);
    // Path traversal detection
    if (normalized.includes('..')) {
      throw new Error('Path traversal detected');
    }
    return `${normalized}:${symbolName}`;
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

// Lazy singleton - only instantiated when first accessed
let _symbolUsageHistoryManager: SymbolUsageHistoryManager | null = null;
export function getSymbolUsageHistoryManager(): SymbolUsageHistoryManager {
  if (!_symbolUsageHistoryManager) {
    _symbolUsageHistoryManager = SymbolUsageHistoryManager.getInstance();
  }
  return _symbolUsageHistoryManager;
}

export { SymbolUsageHistoryManager };
