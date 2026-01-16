import path from 'path';
import { UsageHistoryManager } from './usage-history-manager';
import appConfig from '../config/app-config';

/**
 * File Usage History Manager
 * Manages usage history for @ mention file selections
 */
class FileUsageHistoryManager extends UsageHistoryManager {
  private static instance: FileUsageHistoryManager | null = null;
  private static _filePath: string | null = null;

  private static get filePath(): string {
    if (!FileUsageHistoryManager._filePath) {
      FileUsageHistoryManager._filePath = path.join(appConfig.paths.projectsCacheDir, 'file-usage-history.jsonl');
    }
    return FileUsageHistoryManager._filePath;
  }

  private constructor(filePath: string) {
    super(filePath, {
      maxEntries: 500,
      ttlDays: 30,
    });
  }

  static getInstance(): FileUsageHistoryManager {
    if (!FileUsageHistoryManager.instance) {
      FileUsageHistoryManager.instance = new FileUsageHistoryManager(FileUsageHistoryManager.filePath);
    }
    return FileUsageHistoryManager.instance;
  }

  /**
   * Normalize file path for consistent key storage
   * Removes leading/trailing slashes and normalizes separators
   */
  normalizeKey(filePath: string): string {
    // Path traversal detection BEFORE normalization
    // (path.normalize resolves .. sequences, so check must be done first)
    if (filePath.includes('..')) {
      throw new Error('Path traversal detected');
    }
    const normalized = path.normalize(filePath);
    return normalized.replace(/^\/+|\/+$/g, '');
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

// Lazy singleton - only instantiated when first accessed
let _fileUsageHistoryManager: FileUsageHistoryManager | null = null;
export function getFileUsageHistoryManager(): FileUsageHistoryManager {
  if (!_fileUsageHistoryManager) {
    _fileUsageHistoryManager = FileUsageHistoryManager.getInstance();
  }
  return _fileUsageHistoryManager;
}

export { FileUsageHistoryManager };
