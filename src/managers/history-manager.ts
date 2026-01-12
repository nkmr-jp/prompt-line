import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import config from '../config/app-config';
import { 
  logger, 
  generateId, 
  debounce,
  safeJsonParse
} from '../utils/utils';
import type { 
  HistoryItem, 
  HistoryStats, 
  ExportData,
  DebounceFunction,
  IHistoryManager,
  HistoryConfig
} from '../types';
import {LIMITS} from "../constants";


/**
 * HistoryManager - Optimized history management with LRU caching
 * Provides unlimited history storage with streaming operations for large datasets.
 */
class HistoryManager implements IHistoryManager {
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
      await this.ensureHistoryFile();
      await this.loadRecentHistory();
      
      // Background count calculation to avoid blocking startup
      this.countTotalItemsAsync().catch((error: Error) => {
        logger.warn('Background total count failed:', error);
      });
    } catch (error) {
      logger.error('Failed to initialize history manager:', error);
      this.recentCache = [];
      this.totalItemCount = 0;
      this.totalItemCountCached = false;
    }
  }

  private async ensureHistoryFile(): Promise<void> {
    try {
      await fs.access(this.historyFile);
    } catch {
      // Set restrictive file permissions (owner read/write only)
      await fs.writeFile(this.historyFile, '', { mode: 0o600 });
    }
  }

  private async loadRecentHistory(): Promise<void> {
    try {
      const lines = await this.readLastNLines(this.cacheSize);
      this.recentCache = [];
      this.duplicateCheckSet.clear();

      for (const line of lines) {
        const item = safeJsonParse<HistoryItem>(line);
        if (item && this.validateHistoryItem(item)) {
          this.recentCache.push(item);
          this.duplicateCheckSet.add(item.text);
        }
      }

      // Reverse once at the end for O(n) instead of O(n²)
      this.recentCache.reverse();
    } catch (error) {
      logger.error('Error loading recent history:', error);
      this.recentCache = [];
    }
  }

  private async readLastNLines(lineCount = 100): Promise<string[]> {
    const fd = await fs.open(this.historyFile, 'r');
    const stats = await fd.stat();
    const fileSize = stats.size;

    if (fileSize === 0) {
      await fd.close();
      return [];
    }

    try {
      return await this.readLinesFromEnd(fd, fileSize, lineCount);
    } finally {
      await fd.close();
    }
  }

  /**
   * Read lines from end of file
   * Returns lines in file order (oldest first)
   */
  private async readLinesFromEnd(
    fd: import('fs/promises').FileHandle,
    fileSize: number,
    lineCount: number
  ): Promise<string[]> {
    const CHUNK_SIZE = 8192;
    let position = fileSize;
    const lines: string[] = [];
    let remainder = '';

    while (lines.length < lineCount && position > 0) {
      const readSize = Math.min(CHUNK_SIZE, position);
      position -= readSize;

      const buffer = Buffer.alloc(readSize);
      await fd.read(buffer, 0, readSize, position);

      const chunk = buffer.toString('utf8');
      const { newRemainder, collectedLines } = this.processChunk(chunk, remainder, position, lineCount - lines.length);
      remainder = newRemainder;

      // collectedLines are already in reverse order (newest first in chunk)
      // Push them directly to maintain proper ordering
      lines.push(...collectedLines);
    }

    // Reverse once at the end to get file order (oldest first) - O(n)
    lines.reverse();
    return lines.slice(-lineCount);
  }

  /**
   * Process chunk and extract lines
   * Returns lines in reverse order (newest first in chunk)
   */
  private processChunk(
    chunk: string,
    remainder: string,
    position: number,
    maxLines: number
  ): { newRemainder: string; collectedLines: string[] } {
    const text = chunk + remainder;
    const textLines = text.split('\n');
    const newRemainder = position > 0 ? textLines.shift() || '' : '';

    const collectedLines: string[] = [];
    // Iterate from end to beginning and collect with push - O(n)
    for (let i = textLines.length - 1; i >= 0 && collectedLines.length < maxLines; i--) {
      const line = textLines[i]?.trim();
      if (line) {
        collectedLines.push(line);
      }
    }

    return { newRemainder, collectedLines };
  }

  private async countTotalItems(): Promise<void> {
    if (this.totalItemCountCached) {
      return; // 既にカウント済み
    }
    
    return new Promise((resolve) => {
      let count = 0;
      const stream = createReadStream(this.historyFile);
      const rl = createInterface({
        input: stream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        if (line.trim()) count++;
      });

      rl.on('close', () => {
        this.totalItemCount = count;
        this.totalItemCountCached = true;
        resolve();
      });

      rl.on('error', (error: Error) => {
        logger.error('Error counting history items:', error);
        this.totalItemCount = this.recentCache.length;
        this.totalItemCountCached = true;
        resolve();
      });
    });
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
        return null;
      }

      const duplicateResult = this.handleDuplicateUpdate(trimmedText, appName, directory);
      if (duplicateResult) {
        return duplicateResult;
      }

      const historyItem = this.createHistoryItem(trimmedText, appName, directory);
      this.addItemToCache(historyItem);

      return historyItem;
    } catch (error) {
      logger.error('Failed to add item to history:', error);
      throw error;
    }
  }

  /**
   * Handle duplicate item update - returns existing item if found
   * Only checks the most recent item (recentCache[0]) to avoid unnecessary updates
   */
  private handleDuplicateUpdate(
    trimmedText: string,
    appName?: string,
    directory?: string
  ): HistoryItem | null {
    // Only check the most recent item
    const latestItem = this.recentCache[0];
    if (latestItem && latestItem.text === trimmedText) {
      // Update timestamp only (no file append)
      latestItem.timestamp = Date.now();
      if (appName) latestItem.appName = appName;
      if (directory) latestItem.directory = directory;
      return latestItem;
    }
    return null;
  }

  /**
   * Create a new history item
   */
  private createHistoryItem(text: string, appName?: string, directory?: string): HistoryItem {
    return {
      text,
      timestamp: Date.now(),
      id: generateId(),
      ...(appName && { appName }),
      ...(directory && { directory })
    };
  }

  /**
   * Add item to cache and append queue
   */
  private addItemToCache(historyItem: HistoryItem): void {
    this.recentCache.unshift(historyItem);
    this.duplicateCheckSet.add(historyItem.text);

    if (this.recentCache.length > this.cacheSize) {
      const removed = this.recentCache.pop();
      if (removed) {
        this.duplicateCheckSet.delete(removed.text);
      }
    }

    this.appendQueue.push(historyItem);
    this.debouncedAppend();

    if (this.totalItemCountCached) {
      this.totalItemCount++;
    }
  }

  private async flushAppendQueue(): Promise<void> {
    if (this.appendQueue.length === 0) return;

    const itemsToAppend = [...this.appendQueue];
    this.appendQueue = [];

    try {
      const lines = itemsToAppend
        .map(item => JSON.stringify(item))
        .join('\n') + '\n';

      await fs.appendFile(this.historyFile, lines);
    } catch (error) {
      logger.error('Failed to append to history file:', error);
      // 失敗したアイテムをキューに戻す（先頭に追加してFIFO順序を維持）
      this.appendQueue.unshift(...itemsToAppend);
      throw error;
    }
  }

  getHistory(limit?: number, offset?: number): HistoryItem[] {
    // キャッシュから返す（起動速度優先）
    // 負のoffsetは0として扱う
    const startIndex = Math.max(0, offset ?? 0);

    // limitがundefinedの場合は全キャッシュを返す（後方互換性）
    if (limit === undefined) {
      return [...this.recentCache.slice(startIndex)];
    }

    // limit=0や負のlimitは空配列を返す
    if (limit <= 0) {
      return [];
    }

    const requestedLimit = Math.min(limit, this.cacheSize - startIndex);
    return this.recentCache.slice(startIndex, startIndex + requestedLimit);
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
      // If requested limit is within cache, return from cache (faster)
      if (limit <= this.recentCache.length) {
        return [...this.recentCache.slice(0, limit)];
      }

      // Read from file for larger limits
      const lines = await this.readLastNLines(limit);
      const items: HistoryItem[] = [];

      for (const line of lines) {
        const item = safeJsonParse<HistoryItem>(line);
        if (item && this.validateHistoryItem(item)) {
          items.push(item);
        }
      }

      // Reverse once at the end for newest first - O(n) instead of O(n²)
      items.reverse();
      return items;
    } catch (error) {
      logger.error('Error in getHistoryForSearch:', error);
      // Fallback to cache
      return [...this.recentCache];
    }
  }

  searchHistory(query: string, limit = 10): HistoryItem[] {
    if (!query || !query.trim()) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const results = this.recentCache.filter(item => 
      item.text.toLowerCase().includes(searchTerm)
    );

    return results.slice(0, limit);
  }


  async removeHistoryItem(id: string): Promise<boolean> {
    try {
      // キャッシュから削除
      const initialLength = this.recentCache.length;
      const removedItem = this.recentCache.find(item => item.id === id);
      this.recentCache = this.recentCache.filter(item => item.id !== id);
      
      if (this.recentCache.length < initialLength && removedItem) {
        // duplicateCheckSetからも削除
        this.duplicateCheckSet.delete(removedItem.text);

        // ファイルは永続保護するため、メモリキャッシュのみ削除
        // totalItemCountはファイルがそのままなので変更しない
        return true;
      }

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
    } catch (error) {
      logger.error('Error during history manager cleanup:', error);
    }
  }

  getHistoryStats(): HistoryStats {
    // 必要に応じて遅延カウントを実行（非同期）
    if (!this.totalItemCountCached) {
      this.countTotalItemsAsync().catch((error: Error) => {
        logger.warn('Lazy total count failed:', error);
      });
    }
    
    const totalItems = this.totalItemCountCached ? this.totalItemCount : this.recentCache.length;
    const cachedItems = this.recentCache;
    const totalCharacters = cachedItems.reduce((sum, item) => sum + item.text.length, 0);
    const oldestTimestamp = cachedItems.length > 0 ? 
      Math.min(...cachedItems.map(item => item.timestamp)) : null;
    const newestTimestamp = cachedItems.length > 0 ? 
      Math.max(...cachedItems.map(item => item.timestamp)) : null;

    return {
      totalItems,
      totalCharacters,
      averageLength: cachedItems.length > 0 ? Math.round(totalCharacters / cachedItems.length) : 0,
      oldestTimestamp,
      newestTimestamp,
    };
  }

  private validateHistoryItem(item: unknown): item is HistoryItem {
    return (
      typeof item === 'object' &&
      item !== null &&
      'text' in item &&
      'timestamp' in item &&
      'id' in item &&
      typeof (item as HistoryItem).text === 'string' &&
      typeof (item as HistoryItem).timestamp === 'number' &&
      typeof (item as HistoryItem).id === 'string' &&
      (item as HistoryItem).text.length > 0
    );
  }

  // 既存のHistoryManagerとの互換性のためのメソッド
  updateConfig(_newConfig: Partial<HistoryConfig>): void {
    // 無制限なので特に何もしない
    logger.info('Config update called on HistoryManager (no-op)');
  }


  // Export/Import機能（ストリーミング対応）
  async exportHistory(): Promise<ExportData> {
    const allItems: HistoryItem[] = [];
    
    const stream = createReadStream(this.historyFile);
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const item = safeJsonParse<HistoryItem>(line);
      if (item && this.validateHistoryItem(item)) {
        allItems.push(item);
      }
    }

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

      // バッチで追記
      const lines = exportData.history
        .filter(item => this.validateHistoryItem(item))
        .map(item => JSON.stringify(item))
        .join('\n') + '\n';
      
      await fs.appendFile(this.historyFile, lines);
      
      // キャッシュをリロード
      await this.loadRecentHistory();
      await this.countTotalItems();
      
      logger.info(`History imported: ${exportData.history.length} items, merge: ${merge}`);
    } catch (error) {
      logger.error('Failed to import history:', error);
      throw error;
    }
  }
}

export default HistoryManager;