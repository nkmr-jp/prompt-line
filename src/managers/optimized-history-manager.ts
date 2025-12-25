import config from '../config/app-config';
import { logger, generateId, debounce } from '../utils/utils';
import type {
  HistoryItem,
  HistoryStats,
  ExportData,
  DebounceFunction,
  IHistoryManager,
  HistoryConfig
} from '../types';
import { LIMITS } from "../constants";
import {
  readLastNLines,
  countHistoryItems,
  parseHistoryLines,
  streamHistoryItems,
  validateHistoryItem,
  handleDuplicateInCache,
  addItemToCache as addItemToCacheHelper,
  appendItemsToFile,
  ensureHistoryFileExists,
  calculateHistoryStats,
  removeItemFromCache,
  searchHistoryItems
} from './optimized-history-helpers';


class OptimizedHistoryManager implements IHistoryManager {
  private recentCache: HistoryItem[] = [];
  private cacheSize = LIMITS.MAX_CACHE_ITEMS;
  private historyFile: string;
  private totalItemCount = 0;
  private totalItemCountCached = false;
  private appendQueue: HistoryItem[] = [];
  private debouncedAppend: DebounceFunction<[]>;
  private duplicateCheckSet = new Set<string>();

  constructor() {
    this.historyFile = config.paths.historyFile;
    this.debouncedAppend = debounce(this.flushAppendQueue.bind(this), 100);
  }

  async initialize(): Promise<void> {
    try {
      await ensureHistoryFileExists(this.historyFile);
      await this.loadRecentHistory();
      logger.info(`Optimized history manager initialized with ${this.recentCache.length} cached items (total count will be calculated when needed)`);
      
      // Background count calculation to avoid blocking startup
      this.countTotalItemsAsync().catch((error: Error) => {
        logger.warn('Background total count failed:', error);
      });
    } catch (error) {
      logger.error('Failed to initialize optimized history manager:', error);
      this.recentCache = [];
      this.totalItemCount = 0;
      this.totalItemCountCached = false;
    }
  }


  private async loadRecentHistory(): Promise<void> {
    try {
      const lines = await readLastNLines(this.historyFile, this.cacheSize);
      this.recentCache = parseHistoryLines(lines, validateHistoryItem);
      this.duplicateCheckSet.clear();

      for (const item of this.recentCache) {
        this.duplicateCheckSet.add(item.text);
      }

      logger.debug(`Loaded ${this.recentCache.length} recent history items into cache`);
    } catch (error) {
      logger.error('Error loading recent history:', error);
      this.recentCache = [];
    }
  }

  private async countTotalItems(): Promise<void> {
    if (this.totalItemCountCached) {
      return;
    }

    try {
      this.totalItemCount = await countHistoryItems(this.historyFile);
      this.totalItemCountCached = true;
      logger.debug(`Total item count calculated: ${this.totalItemCount}`);
    } catch (error) {
      logger.error('Error counting history items:', error);
      this.totalItemCount = this.recentCache.length;
      this.totalItemCountCached = true;
    }
  }

  private async countTotalItemsAsync(): Promise<void> {
    // Async background count execution
    setTimeout(async () => {
      try {
        await this.countTotalItems();
      } catch (error) {
        logger.warn('Background total items count failed:', error);
      }
    }, 100);
  }

  async addToHistory(text: string, appName?: string, directory?: string): Promise<HistoryItem | null> {
    try {
      const trimmedText = text.trim();
      if (!trimmedText) {
        logger.debug('Attempted to add empty text to history');
        return null;
      }

      // Check for duplicates
      const duplicateResult = handleDuplicateInCache(
        trimmedText, this.recentCache, this.duplicateCheckSet, appName, directory
      );
      this.recentCache = duplicateResult.updatedCache;
      if (duplicateResult.existingItem) {
        return duplicateResult.existingItem;
      }

      // Create new history item
      const historyItem: HistoryItem = {
        text: trimmedText,
        timestamp: Date.now(),
        id: generateId(),
        ...(appName && { appName }),
        ...(directory && { directory })
      };

      // Add to cache
      const cacheResult = addItemToCacheHelper(
        historyItem, this.recentCache, this.duplicateCheckSet, this.cacheSize
      );
      this.recentCache = cacheResult.updatedCache;
      this.duplicateCheckSet = cacheResult.updatedSet;

      // Queue for persistence
      this.appendQueue.push(historyItem);
      this.debouncedAppend();
      if (this.totalItemCountCached) {
        this.totalItemCount++;
      }

      // Log addition
      logger.debug('Added item to history:', {
        id: historyItem.id,
        length: historyItem.text.length,
        appName: appName || 'unknown',
        directory: directory || 'unknown',
        cacheSize: this.recentCache.length,
        totalItems: this.totalItemCountCached ? this.totalItemCount : 'not calculated'
      });

      return historyItem;
    } catch (error) {
      logger.error('Failed to add item to history:', error);
      throw error;
    }
  }

  private async flushAppendQueue(): Promise<void> {
    if (this.appendQueue.length === 0) return;

    const itemsToAppend = [...this.appendQueue];
    this.appendQueue = [];

    try {
      await appendItemsToFile(this.historyFile, itemsToAppend);
      logger.debug(`Appended ${itemsToAppend.length} items to history file`);
    } catch (error) {
      logger.error('Failed to append to history file:', error);
      this.appendQueue.unshift(...itemsToAppend);
      throw error;
    }
  }

  getHistory(limit?: number): HistoryItem[] {
    // キャッシュから返す（起動速度優先）
    if (!limit) {
      return [...this.recentCache];
    }
    
    const requestedLimit = Math.min(limit, this.cacheSize);
    return this.recentCache.slice(0, requestedLimit);
  }

  getHistoryItem(id: string): HistoryItem | null {
    // まずキャッシュから探す
    const cachedItem = this.recentCache.find(item => item.id === id);
    if (cachedItem) return cachedItem;

    // キャッシュになければnull（フルスキャンは避ける）
    return null;
  }

  getRecentHistory(limit = 10): HistoryItem[] {
    return this.recentCache.slice(0, Math.min(limit, this.recentCache.length));
  }

  /**
   * Get history items for search purposes
   * Reads directly from file to support larger limits than cache
   * @param limit Maximum number of items to return (e.g., 5000 for search)
   */
  async getHistoryForSearch(limit: number): Promise<HistoryItem[]> {
    try {
      if (limit <= this.recentCache.length) {
        return [...this.recentCache.slice(0, limit)];
      }

      const lines = await readLastNLines(this.historyFile, limit);
      const items = parseHistoryLines(lines, validateHistoryItem);

      logger.debug(`getHistoryForSearch: loaded ${items.length} items for search (limit: ${limit})`);
      return items;
    } catch (error) {
      logger.error('Error in getHistoryForSearch:', error);
      return [...this.recentCache];
    }
  }

  searchHistory(query: string, limit = 10): HistoryItem[] {
    return searchHistoryItems(this.recentCache, query, limit);
  }


  async removeHistoryItem(id: string): Promise<boolean> {
    try {
      const result = removeItemFromCache(id, this.recentCache, this.duplicateCheckSet);
      this.recentCache = result.updatedCache;
      this.duplicateCheckSet = result.updatedSet;

      if (result.removed) {
        logger.debug('Removed history item from cache (file preserved):', id);
        return true;
      }

      logger.debug('History item not found for removal:', id);
      return false;
    } catch (error) {
      logger.error('Failed to remove history item:', error);
      throw error;
    }
  }


  async clearHistory(): Promise<void> {
    try {
      await this.flushAppendQueue();
      this.recentCache = [];
      this.duplicateCheckSet.clear();
      this.appendQueue = [];
      
      // ファイルは永続保護するため、メモリキャッシュのみクリア
      // totalItemCountはファイルがそのままなので変更しない
      logger.info('History cache cleared (file preserved)');
    } catch (error) {
      logger.error('Failed to clear history cache:', error);
      throw error;
    }
  }

  async flushPendingSaves(): Promise<void> {
    await this.flushAppendQueue();
  }

  async destroy(): Promise<void> {
    try {
      await this.flushPendingSaves();
      logger.debug('Optimized history manager cleanup completed');
    } catch (error) {
      logger.error('Error during history manager cleanup:', error);
    }
  }

  getHistoryStats(): HistoryStats {
    if (!this.totalItemCountCached) {
      this.countTotalItemsAsync().catch((error: Error) => {
        logger.warn('Lazy total count failed:', error);
      });
    }

    return calculateHistoryStats(this.recentCache, this.totalItemCount, this.totalItemCountCached);
  }


  // 既存のHistoryManagerとの互換性のためのメソッド
  updateConfig(_newConfig: Partial<HistoryConfig>): void {
    // 無制限なので特に何もしない
    logger.info('Config update called on OptimizedHistoryManager (no-op)');
  }


  // Export/Import機能（ストリーミング対応）
  async exportHistory(): Promise<ExportData> {
    const allItems = await streamHistoryItems(this.historyFile, validateHistoryItem);
    allItems.sort((a, b) => b.timestamp - a.timestamp);

    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      history: allItems,
      stats: this.getHistoryStats()
    };
  }

  async importHistory(exportData: ExportData, merge = false): Promise<void> {
    try {
      if (!exportData || !exportData.history || !Array.isArray(exportData.history)) {
        throw new Error('Invalid export data format');
      }

      if (!merge) {
        await this.clearHistory();
      }

      const validItems = exportData.history.filter(item => validateHistoryItem(item));
      await appendItemsToFile(this.historyFile, validItems);

      await this.loadRecentHistory();
      await this.countTotalItems();

      logger.info(`History imported: ${exportData.history.length} items, merge: ${merge}`);
    } catch (error) {
      logger.error('Failed to import history:', error);
      throw error;
    }
  }
}

export default OptimizedHistoryManager;