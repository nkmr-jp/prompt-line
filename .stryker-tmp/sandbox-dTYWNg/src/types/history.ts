/**
 * History domain type definitions
 */
// @ts-nocheck


export interface HistoryItem {
  text: string;
  timestamp: number;
  id: string;
  appName?: string;
  directory?: string;
}

export interface DraftData {
  text: string;
  timestamp: number;
  saved: boolean;
}

export interface HistoryStats {
  totalItems: number;
  totalCharacters: number;
  averageLength: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

export interface HistoryConfig {
  saveInterval: number;
}

export interface DraftConfig {
  saveDelay: number;
}

export interface ExportData {
  version: string;
  exportDate: string;
  history: HistoryItem[];
  stats: HistoryStats;
}

export interface IHistoryManager {
  initialize(): Promise<void>;
  addToHistory(text: string, appName?: string, directory?: string): Promise<HistoryItem | null>;
  getHistory(limit?: number): Promise<HistoryItem[]> | HistoryItem[];
  getHistoryForSearch(limit: number): Promise<HistoryItem[]>;
  getHistoryItem(id: string): HistoryItem | null;
  getRecentHistory(limit?: number): HistoryItem[];
  searchHistory(query: string, limit?: number): Promise<HistoryItem[]> | HistoryItem[];
  removeHistoryItem(id: string): Promise<boolean>;
  clearHistory(): Promise<void>;
  flushPendingSaves(): Promise<void>;
  destroy(): Promise<void>;
  getHistoryStats(): HistoryStats;
  updateConfig(newConfig: Partial<HistoryConfig>): void;
  exportHistory(): Promise<ExportData> | ExportData;
  importHistory(exportData: ExportData, merge?: boolean): Promise<void>;
}
