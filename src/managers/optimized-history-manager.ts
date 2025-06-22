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


class OptimizedHistoryManager implements IHistoryManager {
  private recentCache: HistoryItem[] = [];
  private cacheSize = LIMITS.MAX_VISIBLE_ITEMS;
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

  private async ensureHistoryFile(): Promise<void> {
    try {
      await fs.access(this.historyFile);
    } catch {
      await fs.writeFile(this.historyFile, '');
      logger.debug('Created new history file');
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
          this.recentCache.unshift(item);
          this.duplicateCheckSet.add(item.text);
        }
      }

      logger.debug(`Loaded ${this.recentCache.length} recent history items into cache`);
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
    
    let position = fileSize;
    const lines: string[] = [];
    let remainder = '';
    const chunkSize = 8192; // 8KB chunks
    
    try {
      while (lines.length < lineCount && position > 0) {
        const readSize = Math.min(chunkSize, position);
        position -= readSize;
        
        const buffer = Buffer.alloc(readSize);
        await fd.read(buffer, 0, readSize, position);
        
        const chunk = buffer.toString('utf8');
        const text = chunk + remainder;
        const textLines = text.split('\n');
        
        // 最初の行は不完全な可能性があるので次回に回す
        remainder = position > 0 ? textLines.shift() || '' : '';
        
        // 末尾から有効な行を収集
        for (let i = textLines.length - 1; i >= 0 && lines.length < lineCount; i--) {
          const line = textLines[i]?.trim();
          if (line) {
            lines.unshift(line);
          }
        }
      }
      
      return lines.slice(-lineCount); // 念のため再度制限
        
    } finally {
      await fd.close();
    }
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
        logger.debug(`Total item count calculated: ${count}`);
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

  async addToHistory(text: string, appName?: string): Promise<HistoryItem | null> {
    try {
      const trimmedText = text.trim();
      if (!trimmedText) {
        logger.debug('Attempted to add empty text to history');
        return null;
      }

      if (this.duplicateCheckSet.has(trimmedText)) {
        // Move existing item to latest position
        this.recentCache = this.recentCache.filter(item => item.text !== trimmedText);
        const existingItem = this.recentCache.find(item => item.text === trimmedText);
        if (existingItem) {
          existingItem.timestamp = Date.now();
          if (appName) {
            existingItem.appName = appName;
          }
          this.recentCache.unshift(existingItem);
          return existingItem;
        }
      }

      const historyItem: HistoryItem = {
        text: trimmedText,
        timestamp: Date.now(),
        id: generateId(),
        ...(appName && { appName })
      };

      // Add to cache
      this.recentCache.unshift(historyItem);
      this.duplicateCheckSet.add(trimmedText);

      if (this.recentCache.length > this.cacheSize) {
        const removed = this.recentCache.pop();
        if (removed) {
          this.duplicateCheckSet.delete(removed.text);
        }
      }

      // Add to append queue
      this.appendQueue.push(historyItem);
      this.debouncedAppend();

      if (this.totalItemCountCached) {
        this.totalItemCount++;
      }
      
      logger.debug('Added item to history:', { 
        id: historyItem.id, 
        length: trimmedText.length,
        appName: appName || 'unknown',
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
      const lines = itemsToAppend
        .map(item => JSON.stringify(item))
        .join('\n') + '\n';
      
      await fs.appendFile(this.historyFile, lines);
      logger.debug(`Appended ${itemsToAppend.length} items to history file`);
    } catch (error) {
      logger.error('Failed to append to history file:', error);
      // 失敗したアイテムをキューに戻す
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
    logger.info('Config update called on OptimizedHistoryManager (no-op)');
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

export default OptimizedHistoryManager;