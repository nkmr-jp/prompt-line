// Re-export all types from modular type files for backward compatibility

// History & Draft types
export type {
  HistoryItem,
  DraftData,
  HistoryStats,
  HistoryConfig,
  DraftConfig,
  ExportData,
  IHistoryManager,
  DebounceFunction,
} from './history-types.js';

// Window & App types
export type {
  AppInfo,
  SpaceInfo,
  WindowData,
  WindowBounds,
  StartupPosition,
  WindowConfig,
} from './window-types.js';

// Config types
export type {
  PlatformConfig,
  ShortcutsConfig,
  PathsConfig,
  TimingConfig,
  AppConfig,
  LoggingConfig,
  LogLevel,
} from './config-types.js';

// File Search types
export type {
  FileInfo,
  DirectoryInfo,
  FileSearchSettings,
  DirectoryData,
} from './file-search-types.js';

// File Cache types
export type {
  FileCacheMetadata,
  CachedDirectoryData,
  CachedFileEntry,
  GlobalCacheMetadata,
  FileCacheStats,
} from './file-cache-types.js';

// MdSearch types
export type {
  InputFormatType,
  MdSearchType,
  MdSearchEntry,
  MdSearchItem,
  SlashCommandItem,
  AgentItem,
} from './mdsearch-types.js';

// User Settings types
export type {
  UserSettings,
} from './settings-types.js';
