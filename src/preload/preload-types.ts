/**
 * Preload Script Type Definitions
 * TypeScript interfaces for the Electron API
 */

export interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, func: (...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
  window: {
    hide: () => Promise<void>;
    show: () => Promise<void>;
    focus: () => Promise<void>;
  };
  config: {
    get: (section: string) => Promise<any>;
  };
  app: {
    getInfo: () => Promise<any>;
  };
  pasteText: (text: string) => Promise<void>;
  history: {
    get: () => Promise<any[]>;
    clear: () => Promise<void>;
    remove: (id: string) => Promise<void>;
    search: (query: string) => Promise<any[]>;
  };
  draft: {
    save: (text: string) => Promise<void>;
    get: () => Promise<string | null>;
    clear: () => Promise<void>;
    setDirectory: (directory: string | null) => Promise<void>;
    getDirectory: () => Promise<string | null>;
  };
  slashCommands: {
    get: (query?: string) => Promise<any[]>;
    getFilePath: (commandName: string) => Promise<string | null>;
  };
  agents: {
    get: (query?: string) => Promise<any[]>;
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
    openInEditor: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    checkExists: (filePath: string) => Promise<boolean>;
  };
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  };
  codeSearch: {
    checkRg: () => Promise<{ rgAvailable: boolean; rgPath: string | null }>;
    getSupportedLanguages: () => Promise<{ languages: Array<{ key: string; displayName: string; extension: string }> }>;
    searchSymbols: (
      directory: string,
      language: string,
      options?: { maxSymbols?: number; useCache?: boolean; refreshCache?: boolean }
    ) => Promise<any>;
    getCachedSymbols: (directory: string, language?: string) => Promise<any>;
    clearCache: (directory?: string) => Promise<{ success: boolean }>;
  };
}

// Global type definitions
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
