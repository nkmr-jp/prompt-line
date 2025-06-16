import { promises as fs } from 'fs';
import config from '../config/app-config';
import { 
  logger, 
  generateId, 
  debounce 
} from '../utils/utils';
import type { 
  HistoryItem, 
  HistoryStats, 
  ExportData,
  DebounceFunction,
  IHistoryManager,
  HistoryConfig
} from '../types';

class HistoryManager implements IHistoryManager {
  private historyData: HistoryItem[] = [];
  private historyFile: string;
  private pendingSave = false;
  private hasUnsavedChanges = false;
  private debouncedSave: DebounceFunction<[]>;
  private criticalSave: DebounceFunction<[]>;

  constructor() {
    this.historyFile = config.paths.historyFile;
    
    this.debouncedSave = debounce(this.performSave.bind(this), 2000);
    this.criticalSave = debounce(this.performSave.bind(this), 500);
  }

  async initialize(): Promise<void> {
    try {
      await this.loadHistory();
      logger.info(`History manager initialized with ${this.historyData.length} items`);
    } catch (error) {
      logger.error('Failed to initialize history manager:', error);
      this.historyData = [];
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      const lines = data.trim().split('\n').filter(line => line.trim());
      
      this.historyData = [];
      for (const line of lines) {
        try {
          const item = JSON.parse(line) as HistoryItem;
          if (item && item.text && item.timestamp && item.id) {
            this.historyData.push(item);
          }
        } catch {
          logger.warn('Invalid JSONL line in history file:', line);
        }
      }
      
      this.historyData.sort((a, b) => b.timestamp - a.timestamp);
      
      logger.debug(`Loaded ${this.historyData.length} history items from JSONL`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.historyData = [];
        logger.debug('History file not found, starting with empty history');
      } else {
        logger.error('Error loading history:', error);
        throw error;
      }
    }
  }

  async saveHistory(immediate = false): Promise<void> {
    if (immediate) {
      return this.performSave();
    } else {
      this.hasUnsavedChanges = true;
      this.debouncedSave();
    }
  }

  private async performSave(): Promise<void> {
    if (this.pendingSave) {
      return;
    }

    this.pendingSave = true;
    try {
      const sortedData = [...this.historyData].sort((a, b) => a.timestamp - b.timestamp);
      const jsonlData = sortedData
        .map(item => JSON.stringify(item))
        .join('\n');
      
      await fs.writeFile(this.historyFile, jsonlData + '\n');
      this.hasUnsavedChanges = false;
      logger.debug(`Batch saved ${this.historyData.length} history items to JSONL`);
    } catch (error) {
      logger.error('Failed to save history:', error);
      throw error;
    } finally {
      this.pendingSave = false;
    }
  }

  async addToHistory(text: string, appName?: string): Promise<HistoryItem | null> {
    try {
      const trimmedText = text.trim();
      if (!trimmedText) {
        logger.debug('Attempted to add empty text to history');
        return null;
      }
      
      this.historyData = this.historyData.filter(item => item.text !== trimmedText);
      
      const historyItem: HistoryItem = {
        text: trimmedText,
        timestamp: Date.now(),
        id: generateId(),
        ...(appName && { appName })
      };
      
      this.historyData.unshift(historyItem);
      
      this.criticalSave();
      
      logger.debug('Added item to history (batch save queued):', { 
        id: historyItem.id, 
        length: trimmedText.length,
        appName: appName || 'unknown',
        totalItems: this.historyData.length 
      });
      
      return historyItem;
    } catch (error) {
      logger.error('Failed to add item to history:', error);
      throw error;
    }
  }

  getHistory(limit?: number): HistoryItem[] {
    if (limit === undefined) {
      return [...this.historyData];
    }
    return this.historyData.slice(0, Math.min(limit, this.historyData.length));
  }

  getHistoryItem(id: string): HistoryItem | null {
    return this.historyData.find(item => item.id === id) || null;
  }

  getRecentHistory(limit = 10): HistoryItem[] {
    return this.historyData.slice(0, Math.min(limit, this.historyData.length));
  }

  searchHistory(query: string, limit = 10): HistoryItem[] {
    if (!query || !query.trim()) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const matches = this.historyData.filter(item => 
      item.text.toLowerCase().includes(searchTerm)
    );

    return matches.slice(0, limit);
  }

  async removeHistoryItem(id: string): Promise<boolean> {
    try {
      const initialLength = this.historyData.length;
      this.historyData = this.historyData.filter(item => item.id !== id);
      
      if (this.historyData.length < initialLength) {
        this.criticalSave();
        logger.debug('Removed history item (batch save queued):', id);
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
      this.historyData = [];
      await this.saveHistory(true);
      logger.info('History cleared');
    } catch (error) {
      logger.error('Failed to clear history:', error);
      throw error;
    }
  }

  async flushPendingSaves(): Promise<void> {
    if (this.hasUnsavedChanges) {
      await this.performSave();
    }
  }

  async destroy(): Promise<void> {
    try {
      await this.flushPendingSaves();
      logger.debug('History manager cleanup completed');
    } catch (error) {
      logger.error('Error during history manager cleanup:', error);
    }
  }

  getHistoryStats(): HistoryStats {
    const totalItems = this.historyData.length;
    const totalCharacters = this.historyData.reduce((sum, item) => sum + item.text.length, 0);
    const oldestTimestamp = totalItems > 0 ? Math.min(...this.historyData.map(item => item.timestamp)) : null;
    const newestTimestamp = totalItems > 0 ? Math.max(...this.historyData.map(item => item.timestamp)) : null;

    return {
      totalItems,
      totalCharacters,
      averageLength: totalItems > 0 ? Math.round(totalCharacters / totalItems) : 0,
      oldestTimestamp,
      newestTimestamp,
    };
  }

  updateConfig(newConfig: Partial<HistoryConfig>): void {
    // Legacy method - no configuration to update for unlimited history
    logger.info('Config update called on HistoryManager:', newConfig);
  }


  exportHistory(): ExportData {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      history: this.historyData,
      stats: this.getHistoryStats()
    };
  }

  async importHistory(exportData: ExportData, merge = false): Promise<void> {
    try {
      if (!exportData || !exportData.history || !Array.isArray(exportData.history)) {
        throw new Error('Invalid export data format');
      }

      if (merge) {
        const existingTexts = new Set(this.historyData.map(item => item.text));
        const newItems = exportData.history.filter(item => !existingTexts.has(item.text));
        
        this.historyData = [...this.historyData, ...newItems];
      } else {
        this.historyData = [...exportData.history];
      }

      this.historyData.sort((a, b) => b.timestamp - a.timestamp);

      await this.saveHistory();
      logger.info(`History imported: ${exportData.history.length} items, merge: ${merge}`);
    } catch (error) {
      logger.error('Failed to import history:', error);
      throw error;
    }
  }
}

export default HistoryManager;