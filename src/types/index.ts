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
  directoryData?: DirectoryInfo;
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
  directoryFile: string;
  cacheDir: string;             // Cache root directory
  fileListsCacheDir: string;    // File lists cache directory
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
  addToHistory(text: string, appName?: string, directory?: string): Promise<HistoryItem | null>;
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
  commands?: {
    directories: string[];
  };
  agents?: {
    directories: string[];
  };
  fileSearch?: {
    // Respect .gitignore files (fd only, default: true)
    respectGitignore?: boolean;
    // Additional exclude patterns (applied on top of .gitignore)
    excludePatterns?: string[];
    // Include patterns (force include even if in .gitignore)
    includePatterns?: string[];
    // Maximum number of files to return (default: 5000)
    maxFiles?: number;
    // Include hidden files (starting with .)
    includeHidden?: boolean;
    // Maximum directory depth (null = unlimited)
    maxDepth?: number | null;
    // Follow symbolic links (default: false)
    followSymlinks?: boolean;
  };
  fileOpener?: {
    // Extension-specific application settings (e.g., { "ts": "WebStorm", "md": "Typora" })
    extensions?: Record<string, string>;
    // Default editor when no extension-specific setting exists
    defaultEditor?: string | null;
  };
  // mdSearch configuration (unified command and mention loading)
  mdSearch?: MdSearchEntry[];
}

export interface SlashCommandItem {
  name: string;
  description: string;
  argumentHint?: string; // Hint text shown when editing arguments (after Tab selection)
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
}

export interface AgentItem {
  name: string;
  description: string;
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink?: boolean;
  size?: number;
  modifiedAt?: string;
  error?: string;
}

export interface DirectoryInfo {
  success?: boolean;
  directory?: string;
  files?: FileInfo[];
  fileCount?: number;
  tty?: string;
  pid?: number;
  idePid?: number;
  method?: 'tty' | 'window-title' | 'ide-shell-fast' | 'electron-pty';
  appName?: string;
  bundleId?: string;
  error?: string;
  filesError?: string;
  // File search related fields (fd is always used)
  partial?: boolean;          // Always false (single stage with fd)
  searchMode?: 'recursive';   // Always 'recursive' (single stage with fd)
  // Draft directory fallback related fields
  directoryChanged?: boolean;  // true if directory changed from previous (draft) directory
  previousDirectory?: string;  // previous directory (from draft) for comparison
  fromDraft?: boolean;         // true if this data is from draft fallback (not actual detection)
  // Cache related fields
  fromCache?: boolean;         // true if data was loaded from cache
  cacheAge?: number;           // milliseconds since cache was updated
  // Detection status
  detectionTimedOut?: boolean; // true if directory detection timed out (e.g., large directories like home)
  // File limit status
  fileLimitReached?: boolean;  // true if file count reached maxFiles limit
  maxFiles?: number;           // the maxFiles limit that was applied
}

// File search settings configuration
export interface FileSearchSettings {
  // Respect .gitignore files (fd only, default: true)
  respectGitignore: boolean;
  // Additional exclude patterns (applied on top of .gitignore)
  excludePatterns: string[];
  // Include patterns (force include even if in .gitignore)
  includePatterns: string[];
  // Maximum number of files to return (default: 5000)
  maxFiles: number;
  // Include hidden files (starting with .)
  includeHidden: boolean;
  // Maximum directory depth (null = unlimited)
  maxDepth: number | null;
  // Follow symbolic links (default: false)
  followSymlinks: boolean;
}

// Directory data for file search (cached in renderer)
export interface DirectoryData {
  directory: string;
  files: FileInfo[];
  timestamp: number;
  partial?: boolean;          // Always false (single stage with fd)
  searchMode?: 'recursive';   // Always 'recursive' (single stage with fd)
}

// ============================================================================
// File Cache Related Types
// ============================================================================

// Cache metadata for a cached directory
export interface FileCacheMetadata {
  version: string;
  directory: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  searchMode?: 'recursive';   // Always 'recursive' (single stage with fd)
  gitignoreRespected?: boolean;
  ttlSeconds?: number;
}

// Cached directory data returned from FileCacheManager
export interface CachedDirectoryData {
  directory: string;
  files: FileInfo[];
  metadata: FileCacheMetadata;
}

// Cache entry stored in files.jsonl
export interface CachedFileEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: number;
}

// Global cache metadata for tracking recent directories
export interface GlobalCacheMetadata {
  version: string;
  lastUsedDirectory: string | null;
  lastUsedAt: string | null;
  recentDirectories: Array<{
    directory: string;
    lastUsedAt: string;
  }>;
}

// Cache statistics
export interface FileCacheStats {
  totalCaches: number;
  totalFiles: number;
  oldestCache: string | null;
  newestCache: string | null;
  totalSizeBytes: number;
}

// ============================================================================
// MdSearch Related Types
// ============================================================================

/**
 * mdSearch エントリの種類
 * - command: スラッシュコマンド（/で始まる）
 * - mention: メンション（@で始まる）
 */
export type MdSearchType = 'command' | 'mention';

/**
 * mdSearch 設定エントリ
 */
export interface MdSearchEntry {
  /** 名前テンプレート（例: "{basename}", "agent-{frontmatter@name}"） */
  name: string;
  /** 検索タイプ */
  type: MdSearchType;
  /** 説明テンプレート（例: "{frontmatter@description}"） */
  description: string;
  /** 検索ディレクトリパス */
  path: string;
  /** ファイルパターン（glob形式、例: "*.md", "SKILL.md"） */
  pattern: string;
  /** オプション: argumentHintテンプレート */
  argumentHint?: string;
  /** オプション: 検索候補の最大表示数（デフォルト: 20） */
  maxSuggestions?: number;
  /** オプション: 検索プレフィックス（例: "agent:"）- このプレフィックスで始まるクエリのみ検索対象 */
  searchPrefix?: string;
}

/**
 * 検索結果アイテム（統一型）
 */
export interface MdSearchItem {
  /** 解決済み名前 */
  name: string;
  /** 解決済み説明 */
  description: string;
  /** ソースタイプ */
  type: MdSearchType;
  /** ファイルパス */
  filePath: string;
  /** 元のfrontmatter文字列 */
  frontmatter?: string;
  /** argumentHint（commandタイプのみ） */
  argumentHint?: string;
  /** 検索ソースの識別子（path + pattern） */
  sourceId: string;
}

