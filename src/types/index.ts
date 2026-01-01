/**
 * Central type definitions export
 * All types are re-exported from domain-specific files for backward compatibility
 */

// History domain types
export type {
  HistoryItem,
  DraftData,
  HistoryStats,
  HistoryConfig,
  DraftConfig,
  ExportData,
  IHistoryManager,
} from './history';

// File search domain types
export type {
  FileInfo,
  DirectoryInfo,
  FileSearchSettings,
  FileCacheMetadata,
  CachedDirectoryData,
  CachedFileEntry,
  GlobalCacheMetadata,
  FileCacheStats,
  InputFormatType,
} from './file-search';

// Mention-related types from renderer
export type {
  DirectoryData,
} from '../renderer/mentions';

// Window and application domain types
export type {
  AppInfo,
  SpaceInfo,
  WindowData,
  WindowBounds,
  StartupPosition,
  PlatformConfig,
  WindowConfig,
  ShortcutsConfig,
  PathsConfig,
  TimingConfig,
  AppConfig,
  LoggingConfig,
  LogLevel,
  UserSettings,
  // Mention settings types (@ mentions)
  FileSearchUserSettings,
  SymbolSearchUserSettings,
  MentionsSettings,
  MentionEntry,
  // Slash command settings types
  SlashCommandsSettings,
  SlashCommandEntry,
  // Legacy types (for backward compatibility)
  MdSearchType,
  MdSearchEntry,
  MdSearchItem,
  SlashCommandItem,
  AgentItem,
} from './window';

// IPC communication types
export type {
  SanitizedValue,
  SanitizedRecord,
  IPCResult,
  PasteResult,
  AppInfoResponse,
  ConfigSection,
  ConfigResponse,
  RgCheckResult,
  SupportedLanguage,
  SymbolType,
  SymbolResult,
  SymbolSearchOptions,
  SymbolSearchResult,
  CachedSymbolsResult,
  IPCEventCallback,
  ElectronAPI,
} from './ipc';

// Handler types
export type {
  HandlerStats,
} from './handlers';

// Manager types
export type {
  CacheStatus,
  CacheMetadata,
} from './managers';

// Utility types
export interface DebounceFunction<T extends unknown[]> {
  (...args: T): void;
  cancel?: () => void;
}

