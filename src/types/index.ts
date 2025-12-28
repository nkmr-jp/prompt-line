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
  DirectoryData,
  FileCacheMetadata,
  CachedDirectoryData,
  CachedFileEntry,
  GlobalCacheMetadata,
  FileCacheStats,
  InputFormatType,
} from './file-search';

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

// Utility types
export interface DebounceFunction<T extends unknown[]> {
  (...args: T): void;
  cancel?: () => void;
}

