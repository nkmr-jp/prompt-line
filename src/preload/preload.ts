/**
 * Preload Script for Secure Electron IPC Bridge
 *
 * Provides secure API bridge using contextBridge for enhanced security
 */

import { contextBridge, ipcRenderer } from 'electron';
import { ALLOWED_CHANNELS } from './preload-constants';
import { validateChannel, sanitizeInput } from './preload-validators';
import type { ElectronAPI } from './preload-types';

// Secure API exposure
const electronAPI: ElectronAPI = {
  // IPC communication (with channel restrictions)
  invoke: async (channel: string, ...args: any[]): Promise<any> => {
    if (!validateChannel(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }

    // Sanitize input arguments
    const sanitizedArgs = args.map(arg => sanitizeInput(arg));

    try {
      return await ipcRenderer.invoke(channel, ...sanitizedArgs);
    } catch (error) {
      console.error(`IPC invoke error on channel ${channel}:`, error);
      throw error;
    }
  },

  // Event listeners (with restrictions)
  on: (channel: string, func: (...args: any[]) => void): void => {
    if (!validateChannel(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }

    ipcRenderer.on(channel, (_event, ...args) => {
      try {
        func(...args);
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
    get: async (section: string): Promise<any> => {
      if (section === '') {
        // Get all configuration
        return ipcRenderer.invoke('get-config');
      }
      return ipcRenderer.invoke('get-config', section);
    }
  },

  // Application information
  app: {
    getInfo: async (): Promise<any> => {
      return ipcRenderer.invoke('get-app-info');
    }
  },

  // Text pasting (main feature)
  pasteText: async (text: string): Promise<any> => {
    return ipcRenderer.invoke('paste-text', text);
  },

  // History management
  history: {
    get: async (): Promise<any[]> => {
      return ipcRenderer.invoke('get-history');
    },
    clear: async (): Promise<void> => {
      return ipcRenderer.invoke('clear-history');
    },
    remove: async (id: string): Promise<void> => {
      return ipcRenderer.invoke('remove-history-item', id);
    },
    search: async (query: string): Promise<any[]> => {
      return ipcRenderer.invoke('search-history', query);
    }
  },

  // Draft management
  draft: {
    save: async (text: string): Promise<void> => {
      return ipcRenderer.invoke('save-draft', text);
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

  // Slash commands
  slashCommands: {
    get: async (query?: string): Promise<any[]> => {
      return ipcRenderer.invoke('get-slash-commands', query);
    },
    getFilePath: async (commandName: string): Promise<string | null> => {
      return ipcRenderer.invoke('get-slash-command-file-path', commandName);
    }
  },

  // Agents
  agents: {
    get: async (query?: string): Promise<any[]> => {
      return ipcRenderer.invoke('get-agents', query);
    },
    getFilePath: async (agentName: string): Promise<string | null> => {
      return ipcRenderer.invoke('get-agent-file-path', agentName);
    }
  },

  // MdSearch settings
  mdSearch: {
    getMaxSuggestions: async (type: 'command' | 'mention'): Promise<number> => {
      return ipcRenderer.invoke('get-md-search-max-suggestions', type);
    },
    getSearchPrefixes: async (type: 'command' | 'mention'): Promise<string[]> => {
      return ipcRenderer.invoke('get-md-search-prefixes', type);
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
    checkRg: async (): Promise<{ rgAvailable: boolean; rgPath: string | null }> => {
      return ipcRenderer.invoke('check-rg');
    },
    getSupportedLanguages: async (): Promise<{ languages: Array<{ key: string; displayName: string; extension: string }> }> => {
      return ipcRenderer.invoke('get-supported-languages');
    },
    searchSymbols: async (
      directory: string,
      language: string,
      options?: { maxSymbols?: number; useCache?: boolean; refreshCache?: boolean }
    ): Promise<any> => {
      return ipcRenderer.invoke('search-symbols', directory, language, options);
    },
    getCachedSymbols: async (directory: string, language?: string): Promise<any> => {
      return ipcRenderer.invoke('get-cached-symbols', directory, language);
    },
    clearCache: async (directory?: string): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('clear-symbol-cache', directory);
    }
  }
};

// Safely expose API via contextBridge
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Security logging (development environment only)
if (process.env.NODE_ENV === 'development') {
  console.log('Secure preload script initialized with contextBridge');
  console.log('Allowed IPC channels:', ALLOWED_CHANNELS);
}

// Export type definitions
export type { ElectronAPI };
