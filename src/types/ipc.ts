/**
 * IPC communication type definitions for preload script
 */

import type { HistoryItem } from './history';
import type { SlashCommandItem, AgentItem, UserSettings } from './window';

// ============================================================================
// Input Sanitization Types
// ============================================================================

/**
 * Represents values that can be safely passed through IPC after sanitization
 */
export type SanitizedValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SanitizedValue[]
  | { [key: string]: SanitizedValue };

/**
 * Record type for sanitized objects
 */
export type SanitizedRecord = Record<string, SanitizedValue>;

// ============================================================================
// IPC Response Types
// ============================================================================

/**
 * Standard IPC operation result
 */
export interface IPCResult {
  success: boolean;
  error?: string;
  warning?: string;
}

/**
 * Paste operation result
 */
export interface PasteResult extends IPCResult {
  imagePath?: string;
}

/**
 * Application information response
 */
export interface AppInfoResponse {
  name: string;
  version: string;
  description: string;
  platform: NodeJS.Platform;
  electronVersion: string;
  nodeVersion: string;
  isDevelopment: boolean;
}

/**
 * Configuration sections that can be requested
 */
export type ConfigSection = 'shortcuts' | 'history' | 'draft' | 'timing' | 'app' | 'platform';

/**
 * Configuration response type
 */
export type ConfigResponse = Partial<{
  shortcuts: UserSettings['shortcuts'];
  history: { saveInterval: number };
  draft: { saveDelay: number };
  timing: { windowHideDelay: number; appFocusDelay: number };
  app: { name: string; version: string; description: string };
  platform: { isMac: boolean; isWindows: boolean; isLinux: boolean };
}>;

// ============================================================================
// Code Search Types
// ============================================================================

/**
 * Ripgrep availability check result
 */
export interface RgCheckResult {
  rgAvailable: boolean;
  rgPath: string | null;
}

/**
 * Supported programming language information
 */
export interface SupportedLanguage {
  key: string;
  displayName: string;
  extension: string;
}

/**
 * Symbol types from native tool
 */
export type SymbolType =
  | 'function'
  | 'method'
  | 'class'
  | 'struct'
  | 'interface'
  | 'type'
  | 'constant'
  | 'variable'
  | 'enum'
  | 'property'
  | 'module'
  | 'namespace'
  | 'heading'
  | 'resource'
  | 'data'
  | 'output'
  | 'provider';

/**
 * Symbol result from search
 */
export interface SymbolResult {
  name: string;
  type: SymbolType;
  filePath: string;
  relativePath: string;
  lineNumber: number;
  lineContent: string;
  language: string;
}

/**
 * Symbol search options
 */
export interface SymbolSearchOptions {
  maxSymbols?: number;
  useCache?: boolean;
  refreshCache?: boolean;
  /** Query string for filtering symbols (Main process filtering for performance) */
  query?: string;
  /** Symbol type filter (e.g., 'func', 'class', 'interface') */
  symbolTypeFilter?: string | null;
  /** Maximum results to return (default: 50) */
  maxResults?: number;
  /** File path filter (e.g., 'src/main.ts') for single-file symbol retrieval */
  relativePath?: string;
}

/**
 * Symbol search result
 */
export interface SymbolSearchResult {
  success: boolean;
  directory?: string;
  language?: string;
  symbols: SymbolResult[];
  symbolCount: number;
  unfilteredCount?: number; // Number of symbols before relativePath filtering
  searchMode: 'full' | 'cached';
  partial: boolean;
  maxSymbols: number;
  error?: string;
}

/**
 * Cached symbols result
 */
export interface CachedSymbolsResult {
  success: boolean;
  symbols?: SymbolResult[];
  cacheTimestamp?: number;
  error?: string;
}

// ============================================================================
// IPC Event Callback Types
// ============================================================================

/**
 * IPC event callback function type
 */
export type IPCEventCallback = (...args: SanitizedValue[]) => void;

// ============================================================================
// ElectronAPI Type Definitions
// ============================================================================

/**
 * Electron API exposed via contextBridge
 */
export interface ElectronAPI {
  invoke: (channel: string, ...args: SanitizedValue[]) => Promise<SanitizedValue>;
  on: (channel: string, func: IPCEventCallback) => void;
  removeAllListeners: (channel: string) => void;
  window: {
    hide: () => Promise<void>;
    show: () => Promise<void>;
    focus: () => Promise<void>;
  };
  config: {
    get: (section: string) => Promise<ConfigResponse>;
  };
  app: {
    getInfo: () => Promise<AppInfoResponse>;
  };
  pasteText: (text: string) => Promise<PasteResult>;
  history: {
    get: (options?: { limit?: number; offset?: number }) => Promise<HistoryItem[]>;
    clear: () => Promise<void>;
    remove: (id: string) => Promise<void>;
    search: (query: string) => Promise<HistoryItem[]>;
  };
  draft: {
    save: (text: string) => Promise<void>;
    get: () => Promise<string | null>;
    clear: () => Promise<void>;
    setDirectory: (directory: string | null) => Promise<void>;
    getDirectory: () => Promise<string | null>;
  };
  slashCommands: {
    get: (query?: string) => Promise<SlashCommandItem[]>;
    getFilePath: (commandName: string) => Promise<string | null>;
    hasFile: (commandName: string) => Promise<boolean>;
    // Global slash command cache
    registerGlobal: (commandName: string) => Promise<IPCResult>;
    getGlobalCommands: () => Promise<string[]>;
    // Usage bonus calculation for sorting
    getUsageBonuses: (commandNames: string[]) => Promise<Record<string, number>>;
  };
  agents: {
    get: (query?: string) => Promise<AgentItem[]>;
    getFilePath: (agentName: string) => Promise<string | null>;
  };
  mdSearch: {
    getMaxSuggestions: (type: 'command' | 'mention') => Promise<number>;
    getSearchPrefixes: (type: 'command' | 'mention') => Promise<string[]>;
  };
  fileSearch: {
    getMaxSuggestions: () => Promise<number>;
  };
  file: {
    openInEditor: (filePath: string) => Promise<IPCResult>;
    checkExists: (filePath: string) => Promise<boolean>;
  };
  shell: {
    openExternal: (url: string) => Promise<IPCResult>;
  };
  codeSearch: {
    checkRg: () => Promise<RgCheckResult>;
    getSupportedLanguages: () => Promise<{ languages: SupportedLanguage[] }>;
    searchSymbols: (
      directory: string,
      language: string,
      options?: SymbolSearchOptions
    ) => Promise<SymbolSearchResult>;
    getCachedSymbols: (directory: string, language?: string) => Promise<CachedSymbolsResult>;
    clearCache: (directory?: string) => Promise<IPCResult>;
  };
  atPathCache: {
    register: (directory: string, atPath: string) => Promise<IPCResult>;
    getPaths: (directory: string) => Promise<string[]>;
    // Global at-path cache (for mdSearch agents and other project-independent items)
    registerGlobal: (atPath: string) => Promise<IPCResult>;
    getGlobalPaths: () => Promise<string[]>;
  };
  usageHistory: {
    recordFileUsage: (filePath: string) => Promise<IPCResult>;
    getFileUsageBonuses: (filePaths: string[]) => Promise<Record<string, number>>;
    recordSymbolUsage: (filePath: string, symbolName: string) => Promise<IPCResult>;
    getSymbolUsageBonuses: (symbols: Array<{ filePath: string; symbolName: string }>) => Promise<Record<string, number>>;
    recordAgentUsage: (agentName: string) => Promise<IPCResult>;
    getAgentUsageBonuses: (agentNames: string[]) => Promise<Record<string, number>>;
  };
}
