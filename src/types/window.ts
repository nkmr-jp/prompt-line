/**
 * Window and application domain type definitions
 */

import type { HistoryItem, DraftData } from './history';
import type { DirectoryInfo } from './file-search';

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
  fileSearchEnabled?: boolean;
  symbolSearchEnabled?: boolean;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type StartupPosition = 'cursor' | 'center' | 'active-window-center' | 'active-text-field';

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
  projectsCacheDir: string;     // Projects cache directory
  builtInCommandsDir: string;   // Built-in slash commands directory
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
  fileOpener?: {
    // Extension-specific application settings (e.g., { "ts": "WebStorm", "md": "Typora" })
    extensions?: Record<string, string>;
    // Default editor when no extension-specific setting exists
    defaultEditor?: string | null;
  };
  // Slash command settings (built-in and user-defined)
  slashCommands?: SlashCommandsSettings;
  // Mention settings (@ mentions: fileSearch, symbolSearch, userDefined)
  mentions?: MentionsSettings;

  // Legacy: fileSearch configuration (use mentions.fileSearch instead)
  fileSearch?: FileSearchUserSettings;
  // Legacy: symbolSearch configuration (use mentions.symbolSearch instead)
  symbolSearch?: SymbolSearchUserSettings;
  // Legacy: mdSearch configuration (for backward compatibility)
  mdSearch?: MdSearchEntry[];
  // Legacy: Built-in commands configuration (use slashCommands.builtIn instead)
  builtInCommands?: {
    tools?: string[];
  };
}

// ============================================================================
// Mention Settings Types (@ mentions)
// ============================================================================

import type { InputFormatType } from './file-search';

/**
 * File search user settings (@path/to/file completion)
 * All fields are optional - defaults are applied by the application
 */
export interface FileSearchUserSettings {
  /** Respect .gitignore files (fd only, default: true) */
  respectGitignore?: boolean;
  /** Additional exclude patterns (applied on top of .gitignore) */
  excludePatterns?: string[];
  /** Include patterns (force include even if in .gitignore) */
  includePatterns?: string[];
  /** Maximum number of files to return (default: 5000) */
  maxFiles?: number;
  /** Include hidden files (starting with .) */
  includeHidden?: boolean;
  /** Maximum directory depth (null = unlimited) */
  maxDepth?: number | null;
  /** Follow symbolic links (default: false) */
  followSymlinks?: boolean;
  /** Custom path to fd command (null = auto-detect from common paths) */
  fdPath?: string | null;
  /** Input format: 'name' (file name only) or 'path' (relative path, default) */
  inputFormat?: InputFormatType;
  /** Maximum number of suggestions to show (default: 50) */
  maxSuggestions?: number;
}

/**
 * Symbol search user settings (@language:query syntax)
 * All fields are optional - defaults are applied by the application
 */
export interface SymbolSearchUserSettings {
  /** Maximum number of symbols to return (default: 200000) */
  maxSymbols?: number;
  /** Search timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Custom path to ripgrep command (null = auto-detect from common paths) */
  rgPath?: string | null;
  /** Additional exclude patterns (glob patterns like "vendor/**", "*.generated.go") */
  excludePatterns?: string[];
  /** Include patterns (force include even if excluded by default) */
  includePatterns?: string[];
}

/**
 * Mention settings combining fileSearch, symbolSearch, and userDefined mentions
 */
export interface MentionsSettings {
  /** File search settings (@path/to/file) */
  fileSearch?: FileSearchUserSettings;
  /** Symbol search settings (@ts:Config, @go:Handler) */
  symbolSearch?: SymbolSearchUserSettings;
  /** Markdown-based mentions from markdown files */
  mdSearch?: MentionEntry[];
}

// ============================================================================
// Slash Command Settings Types
// ============================================================================

/**
 * Slash command settings combining built-in and user-defined commands
 */
export interface SlashCommandsSettings {
  /** Built-in commands: list of tools to enable (e.g., ['claude', 'codex', 'gemini']) */
  builtIn?: string[];
  /** Custom slash commands from markdown files */
  custom?: SlashCommandEntry[];
}

/**
 * User-defined slash command entry
 */
export interface SlashCommandEntry {
  /** 名前テンプレート（例: "{basename}", "{frontmatter@name}"） */
  name: string;
  /** 説明テンプレート（例: "{frontmatter@description}"） */
  description: string;
  /** 検索ディレクトリパス */
  path: string;
  /** ファイルパターン（glob形式、例: "*.md"） */
  pattern: string;
  /** オプション: argumentHintテンプレート */
  argumentHint?: string;
  /** オプション: 検索候補の最大表示数（デフォルト: 20） */
  maxSuggestions?: number;
  /** オプション: 名前ソート順（デフォルト: 'asc'） */
  sortOrder?: 'asc' | 'desc';
  /** オプション: label（静的な値 "skill" または テンプレート "{frontmatter@label}"） */
  label?: string;
  /** オプション: ラベルとハイライトの色（purple, blue, green, orange, red, gray） */
  color?: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'gray';
  /** オプション: プレフィックスパターン - 特定JSONファイルからプレフィックスを動的に読み込むためのパターン */
  prefixPattern?: string;
}

/**
 * Mention entry (@ mentions from markdown files)
 */
export interface MentionEntry {
  /** 名前テンプレート（例: "{basename}", "agent-{frontmatter@name}"） */
  name: string;
  /** 説明テンプレート（例: "{frontmatter@description}"） */
  description: string;
  /** 検索ディレクトリパス */
  path: string;
  /** ファイルパターン（glob形式、例: "*.md"） */
  pattern: string;
  /** オプション: 検索候補の最大表示数（デフォルト: 20） */
  maxSuggestions?: number;
  /** オプション: 検索プレフィックス（例: "agent"）- 自動で : が追加されます（@agent: で検索） */
  searchPrefix?: string;
  /** オプション: 名前ソート順（デフォルト: 'asc'） */
  sortOrder?: 'asc' | 'desc';
  /** オプション: 入力フォーマット（デフォルト: 'name'） */
  inputFormat?: InputFormatType;
}

// ============================================================================
// MdSearch Related Types (Legacy - for backward compatibility)
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
  /** オプション: label（静的な値 "skill" または テンプレート "{frontmatter@label}"） */
  label?: string;
  /** オプション: ラベルとハイライトの色（purple, blue, green, orange, red, gray） */
  color?: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'gray';
  /** オプション: argumentHintテンプレート */
  argumentHint?: string;
  /** オプション: 検索候補の最大表示数（デフォルト: 20） */
  maxSuggestions?: number;
  /** オプション: 検索プレフィックス（例: "agent"）- 自動で : が追加されます（@agent: で検索） */
  searchPrefix?: string;
  /** オプション: 名前ソート順（デフォルト: 'asc'） - 'asc': 昇順, 'desc': 降順 */
  sortOrder?: 'asc' | 'desc';
  /** オプション: 入力フォーマット（デフォルト: 'name'） - 'name': 名前のみ, 'path': ファイルパス */
  inputFormat?: InputFormatType;
  /** オプション: プレフィックスパターン - 特定JSONファイルからプレフィックスを動的に読み込むためのパターン */
  prefixPattern?: string;
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
  /** label（オプション） */
  label?: string;
  /** ラベルとハイライトの色（オプション） */
  color?: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'gray';
  /** argumentHint（commandタイプのみ） */
  argumentHint?: string;
  /** 検索ソースの識別子（path + pattern） */
  sourceId: string;
  /** 入力フォーマット（'name' | 'path'） */
  inputFormat?: InputFormatType;
}

export interface SlashCommandItem {
  name: string;
  description: string;
  label?: string;  // Label text (e.g., from frontmatter)
  color?: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'gray';  // Color for label and highlight
  argumentHint?: string; // Hint text shown when editing arguments (after Tab selection)
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
  inputFormat?: InputFormatType;  // 入力フォーマット（'name' | 'path'）
  source?: string;  // Source tool identifier (e.g., 'claude-code') for filtering
  displayName?: string;  // Human-readable source name for display (e.g., 'Claude Code')
}

export interface AgentItem {
  name: string;
  description: string;
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
  inputFormat?: InputFormatType;  // 入力フォーマット（'name' | 'path'）
}
