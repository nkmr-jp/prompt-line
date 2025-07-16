export interface HistoryItem {
  text: string;
  timestamp: number;
  id: string;
  appName?: string;
}

export interface DraftData {
  text: string;
  timestamp: number;
  saved: boolean;
}

export interface AppInfo {
  name: string;
  bundleId?: string | null;
}

export interface SpaceInfo {
  method: string;
  signature: string;
  frontmostApp?: AppInfo | string | null;
  windowCount: number;
  appCount: number;
  apps: Array<{
    name: string;
    pid: number;
    windowCount: number;
    isActive: boolean;
  }>;
}

export interface WindowData {
  sourceApp?: AppInfo | string | null;
  currentSpaceInfo?: SpaceInfo | null;
  history?: HistoryItem[];
  draft?: string | DraftData | null;
  settings?: UserSettings;
}

export interface HistoryStats {
  totalItems: number;
  totalCharacters: number;
  averageLength: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

export interface PlatformConfig {
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
}

export interface WindowConfig {
  width: number;
  height: number;
  frame: boolean;
  transparent: boolean;
  backgroundColor?: string;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
  resizable: boolean;
  webPreferences: {
    nodeIntegration: boolean;
    contextIsolation: boolean;
    webSecurity: boolean;
    preload?: string;  // Preload script path
    spellcheck: boolean;
    disableDialogs: boolean;
    enableWebSQL: boolean;
    experimentalFeatures: boolean;
    defaultEncoding: string;
    offscreen: boolean;
    enablePreferredSizeMode: boolean;
    disableHtmlFullscreenWindowResize: boolean;
    allowRunningInsecureContent?: boolean;  // Security setting
    sandbox?: boolean;  // Sandbox setting
  };
}

export interface ShortcutsConfig {
  main: string;
  paste: string;
  close: string;
  historyNext: string;
  historyPrev: string;
  search: string;
}

export interface PathsConfig {
  userDataDir: string;
  historyFile: string;
  draftFile: string;
  logFile: string;
  imagesDir: string;
}

export interface HistoryConfig {
  saveInterval: number;
}

export interface DraftConfig {
  saveDelay: number;
}

export interface TimingConfig {
  windowHideDelay: number;
  appFocusDelay: number;
}

export interface AppConfig {
  name: string;
  version: string;
  description: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableFileLogging: boolean;
  maxLogFileSize: number;
  maxLogFiles: number;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DebounceFunction<T extends unknown[]> {
  (...args: T): void;
  cancel?: () => void;
}

export interface ExportData {
  version: string;
  exportDate: string;
  history: HistoryItem[];
  stats: HistoryStats;
}

export interface IHistoryManager {
  initialize(): Promise<void>;
  addToHistory(text: string, appName?: string): Promise<HistoryItem | null>;
  getHistory(limit?: number): Promise<HistoryItem[]> | HistoryItem[];
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

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type StartupPosition = 'cursor' | 'center' | 'active-window-center' | 'active-text-field';

export interface UserSettings {
  shortcuts: {
    main: string;
    paste: string;
    close: string;
    historyNext: string;
    historyPrev: string;
    search: string;
  };
  window: {
    position: StartupPosition;
    width: number;
    height: number;
  };
}

