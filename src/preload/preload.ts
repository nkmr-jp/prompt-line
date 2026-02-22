/**
 * Preload Script for Secure Electron IPC Bridge
 *
 * Provides secure API bridge using contextBridge for enhanced security
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  SanitizedValue,
  SanitizedRecord,
  IPCResult,
  PasteResult,
  AppInfoResponse,
  ConfigResponse,
  RgCheckResult,
  SupportedLanguage,
  SymbolSearchOptions,
  SymbolSearchResult,
  CachedSymbolsResult,
  IPCEventCallback,
  ElectronAPI,
} from '../types/ipc';
import type { HistoryItem, AgentSkillItem, AgentItem } from '../types';

// Security: Only expose allowed IPC channels
const ALLOWED_CHANNELS = [
  'paste-text',
  'paste-image',
  'get-history',
  'clear-history',
  'remove-history-item',
  'search-history',
  'save-draft',
  'clear-draft',
  'get-draft',
  'set-draft-directory',
  'get-draft-directory',
  'hide-window',
  'show-window',
  'get-config',
  'get-app-info',
  'focus-window',
  'window-shown',
  'get-agent-skills',
  'get-agent-skill-file-path',
  'has-command-file',
  'directory-data-updated',
  'open-settings',
  'open-settings-directory',
  'get-agents',
  'get-agent-file-path',
  'get-custom-search-max-suggestions',
  'get-custom-search-prefixes',
  'get-file-search-max-suggestions',
  'open-file-in-editor',
  'check-file-exists',
  'open-external-url',
  'reveal-in-finder',
  // Code search channels
  'check-rg',
  'get-supported-languages',
  'search-symbols',
  'get-cached-symbols',
  'clear-symbol-cache',
  // At-path cache channels (for highlighting symbols with spaces)
  'register-at-path',
  'get-registered-at-paths',
  // Global at-path cache channels (for customSearch agents and other project-independent items)
  'register-global-at-path',
  'get-global-at-paths',
  // Draft to history channel
  'save-draft-to-history',
  // Agent skill cache channels
  'register-global-agent-skill',
  'get-global-agent-skills',
  'get-usage-bonuses',
  // Usage history channels
  'record-file-usage',
  'get-file-usage-bonuses',
  'record-symbol-usage',
  'get-symbol-usage-bonuses',
  'record-agent-usage',
  'get-agent-usage-bonuses',
  // Settings update notification channel
  'settings-updated'
];

// IPC channel validation with additional security checks
function validateChannel(channel: string): boolean {
  // Check if channel is in allowed list
  if (!ALLOWED_CHANNELS.includes(channel)) {
    return false;
  }
  
  // Additional validation: prevent prototype pollution
  if (channel.includes('__proto__') || channel.includes('constructor') || channel.includes('prototype')) {
    return false;
  }
  
  // Prevent path traversal attempts
  if (channel.includes('../') || channel.includes('..\\')) {
    return false;
  }
  
  return true;
}

// Constants for input sanitization
const MAX_RECURSION_DEPTH = 10;
const MAX_STRING_LENGTH = 1000000; // 1MB limit
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

// Sanitize string input
function sanitizeString(input: string): string {
  if (input.length > MAX_STRING_LENGTH) {
    throw new Error('Input too long');
  }
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Check for dangerous object properties (prototype pollution prevention)
function checkDangerousProperties(obj: object): void {
  for (const key of DANGEROUS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      throw new Error('Potentially dangerous object properties detected');
    }
  }
}

// Sanitize object input recursively
function sanitizeObject(input: object, depth: number): SanitizedRecord {
  checkDangerousProperties(input);

  const sanitized: SanitizedRecord = {};
  for (const key of Object.keys(input)) {
    if (DANGEROUS_KEYS.includes(key)) {
      throw new Error('Potentially dangerous object key detected');
    }
    sanitized[key] = sanitizeInput((input as Record<string, unknown>)[key], depth + 1);
  }
  return sanitized;
}

// Input sanitization helper with recursive support
function sanitizeInput(input: unknown, depth = 0): SanitizedValue {
  if (depth > MAX_RECURSION_DEPTH) {
    throw new Error('Input nesting too deep');
  }

  if (typeof input === 'string') return sanitizeString(input);
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((item) => sanitizeInput(item, depth + 1));
  if (typeof input === 'object') return sanitizeObject(input, depth);

  return null;
}

// Secure API exposure
const electronAPI: ElectronAPI = {
  // IPC communication (with channel restrictions)
  invoke: async (channel: string, ...args: SanitizedValue[]): Promise<SanitizedValue> => {
    if (!validateChannel(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }

    // Sanitize input arguments
    const sanitizedArgs = args.map((arg) => sanitizeInput(arg));

    try {
      return await ipcRenderer.invoke(channel, ...sanitizedArgs);
    } catch (error) {
      console.error(`IPC invoke error on channel ${channel}:`, error);
      throw error;
    }
  },

  // Event listeners (with restrictions)
  on: (channel: string, func: IPCEventCallback): void => {
    if (!validateChannel(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }

    ipcRenderer.on(channel, (_event, ...args) => {
      try {
        func(...(args as SanitizedValue[]));
      } catch (error) {
        console.error(`IPC event handler error on channel ${channel}:`, error);
      }
    });
  },

  // Remove event listeners
  removeAllListeners: (channel: string): void => {
    if (!validateChannel(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }
    ipcRenderer.removeAllListeners(channel);
  },

  // Note: Clipboard operations are handled internally by the main process
  // No direct clipboard access is exposed to the renderer for security reasons

  // Window control
  window: {
    hide: async (): Promise<void> => {
      return ipcRenderer.invoke('hide-window');
    },
    show: async (): Promise<void> => {
      return ipcRenderer.invoke('show-window');
    },
    focus: async (): Promise<void> => {
      return ipcRenderer.invoke('focus-window');
    }
  },

  // Configuration management
  config: {
    get: async (section: string): Promise<ConfigResponse> => {
      if (section === '') {
        // Get all configuration
        return ipcRenderer.invoke('get-config');
      }
      return ipcRenderer.invoke('get-config', section);
    },
  },

  // Application information
  app: {
    getInfo: async (): Promise<AppInfoResponse> => {
      return ipcRenderer.invoke('get-app-info');
    },
  },

  // Text pasting (main feature)
  pasteText: async (text: string): Promise<PasteResult> => {
    return ipcRenderer.invoke('paste-text', text);
  },

  // History management
  history: {
    get: async (options?: { limit?: number; offset?: number }): Promise<HistoryItem[]> => {
      return ipcRenderer.invoke('get-history', options);
    },
    clear: async (): Promise<void> => {
      return ipcRenderer.invoke('clear-history');
    },
    remove: async (id: string): Promise<void> => {
      return ipcRenderer.invoke('remove-history-item', id);
    },
    search: async (query: string): Promise<HistoryItem[]> => {
      return ipcRenderer.invoke('search-history', query);
    },
  },

  // Draft management
  draft: {
    save: async (text: string, scrollTop = 0): Promise<void> => {
      return ipcRenderer.invoke('save-draft', text, scrollTop);
    },
    get: async (): Promise<string | null> => {
      return ipcRenderer.invoke('get-draft');
    },
    clear: async (): Promise<void> => {
      return ipcRenderer.invoke('clear-draft');
    },
    setDirectory: async (directory: string | null): Promise<void> => {
      return ipcRenderer.invoke('set-draft-directory', directory);
    },
    getDirectory: async (): Promise<string | null> => {
      return ipcRenderer.invoke('get-draft-directory');
    }
  },

  // Agent skills (slash commands)
  agentSkills: {
    get: async (query?: string): Promise<AgentSkillItem[]> => {
      return ipcRenderer.invoke('get-agent-skills', query);
    },
    getFilePath: async (commandName: string): Promise<string | null> => {
      return ipcRenderer.invoke('get-agent-skill-file-path', commandName);
    },
    hasFile: async (commandName: string): Promise<boolean> => {
      return ipcRenderer.invoke('has-command-file', commandName);
    },
    // Global agent skill cache
    registerGlobal: async (commandName: string): Promise<IPCResult> => {
      return ipcRenderer.invoke('register-global-agent-skill', commandName);
    },
    getGlobalSkills: async (): Promise<string[]> => {
      return ipcRenderer.invoke('get-global-agent-skills');
    },
    // Usage bonus calculation for sorting
    getUsageBonuses: async (commandNames: string[]): Promise<Record<string, number>> => {
      return ipcRenderer.invoke('get-usage-bonuses', commandNames);
    },
  },

  // Agents
  agents: {
    get: async (query?: string): Promise<AgentItem[]> => {
      return ipcRenderer.invoke('get-agents', query);
    },
    getFilePath: async (agentName: string): Promise<string | null> => {
      return ipcRenderer.invoke('get-agent-file-path', agentName);
    },
  },

  // CustomSearch settings
  customSearch: {
    getMaxSuggestions: async (type: 'command' | 'mention'): Promise<number> => {
      return ipcRenderer.invoke('get-custom-search-max-suggestions', type);
    },
    getSearchPrefixes: async (type: 'command' | 'mention'): Promise<string[]> => {
      return ipcRenderer.invoke('get-custom-search-prefixes', type);
    }
  },

  // FileSearch settings (for @ mentions and symbol search)
  fileSearch: {
    getMaxSuggestions: async (): Promise<number> => {
      return ipcRenderer.invoke('get-file-search-max-suggestions');
    }
  },

  // File operations
  file: {
    openInEditor: async (filePath: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('open-file-in-editor', filePath);
    },
    checkExists: async (filePath: string): Promise<boolean> => {
      return ipcRenderer.invoke('check-file-exists', filePath);
    },
    revealInFinder: async (filePath: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('reveal-in-finder', filePath);
    }
  },

  // Shell operations
  shell: {
    openExternal: async (url: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('open-external-url', url);
    }
  },

  // Code search (symbol search with ripgrep)
  codeSearch: {
    checkRg: async (): Promise<RgCheckResult> => {
      return ipcRenderer.invoke('check-rg');
    },
    getSupportedLanguages: async (): Promise<{ languages: SupportedLanguage[] }> => {
      return ipcRenderer.invoke('get-supported-languages');
    },
    searchSymbols: async (
      directory: string,
      language: string,
      options?: SymbolSearchOptions
    ): Promise<SymbolSearchResult> => {
      return ipcRenderer.invoke('search-symbols', directory, language, options);
    },
    getCachedSymbols: async (directory: string, language?: string): Promise<CachedSymbolsResult> => {
      return ipcRenderer.invoke('get-cached-symbols', directory, language);
    },
    clearCache: async (directory?: string): Promise<IPCResult> => {
      return ipcRenderer.invoke('clear-symbol-cache', directory);
    },
  },

  // At-path cache (for highlighting symbols with spaces)
  atPathCache: {
    register: async (directory: string, atPath: string): Promise<IPCResult> => {
      return ipcRenderer.invoke('register-at-path', directory, atPath);
    },
    getPaths: async (directory: string): Promise<string[]> => {
      return ipcRenderer.invoke('get-registered-at-paths', directory);
    },
    // Global at-path cache (for customSearch agents and other project-independent items)
    registerGlobal: async (atPath: string): Promise<IPCResult> => {
      return ipcRenderer.invoke('register-global-at-path', atPath);
    },
    getGlobalPaths: async (): Promise<string[]> => {
      return ipcRenderer.invoke('get-global-at-paths');
    },
  },

  // Usage history tracking
  usageHistory: {
    recordFileUsage: async (filePath: string): Promise<IPCResult> => {
      return ipcRenderer.invoke('record-file-usage', filePath);
    },
    getFileUsageBonuses: async (filePaths: string[]): Promise<Record<string, number>> => {
      return ipcRenderer.invoke('get-file-usage-bonuses', filePaths);
    },
    recordSymbolUsage: async (filePath: string, symbolName: string): Promise<IPCResult> => {
      return ipcRenderer.invoke('record-symbol-usage', filePath, symbolName);
    },
    getSymbolUsageBonuses: async (symbols: Array<{ filePath: string; symbolName: string }>): Promise<Record<string, number>> => {
      return ipcRenderer.invoke('get-symbol-usage-bonuses', symbols);
    },
    recordAgentUsage: async (agentName: string): Promise<IPCResult> => {
      return ipcRenderer.invoke('record-agent-usage', agentName);
    },
    getAgentUsageBonuses: async (agentNames: string[]): Promise<Record<string, number>> => {
      return ipcRenderer.invoke('get-agent-usage-bonuses', agentNames);
    },
  },
};

// Safely expose API via contextBridge
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Listen for settings updates from main process and dispatch custom event
ipcRenderer.on('settings-updated', (_event, settings) => {
  // eslint-disable-next-line no-undef
  window.dispatchEvent(new CustomEvent('settings-updated', { detail: settings }));
});

// Re-export ElectronAPI type for external usage
export type { ElectronAPI } from '../types/ipc';

// Global type definitions
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Security logging (development environment only)
if (process.env.NODE_ENV === 'development') {
  console.log('Secure preload script initialized with contextBridge');
  console.log('Allowed IPC channels:', ALLOWED_CHANNELS);
}