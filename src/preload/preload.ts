/**
 * Preload Script for Secure Electron IPC Bridge
 * 
 * Provides secure API bridge using contextBridge for enhanced security
 */

import { contextBridge, ipcRenderer } from 'electron';

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
  'get-slash-commands',
  'get-slash-command-file-path',
  'directory-data-updated',
  'open-settings',
  'get-agents',
  'get-agent-file-path',
  'get-md-search-max-suggestions',
  'get-md-search-prefixes',
  'open-file-in-editor',
  'check-file-exists',
  'open-external-url'
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

// Input sanitization helper with recursive support
function sanitizeInput(input: any, depth = 0): any {
  // 再帰深度制限（無限ループ防止）
  const MAX_DEPTH = 10;
  if (depth > MAX_DEPTH) {
    throw new Error('Input nesting too deep');
  }

  if (typeof input === 'string') {
    // Prevent excessive length
    if (input.length > 1000000) { // 1MB limit
      throw new Error('Input too long');
    }

    // Basic sanitization
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item, depth + 1));
  }

  if (typeof input === 'object' && input !== null) {
    // Prevent prototype pollution
    if (Object.prototype.hasOwnProperty.call(input, '__proto__') ||
        Object.prototype.hasOwnProperty.call(input, 'constructor') ||
        Object.prototype.hasOwnProperty.call(input, 'prototype')) {
      throw new Error('Potentially dangerous object properties detected');
    }

    // 再帰的にサニタイズ
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      // キー名もチェック
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error('Potentially dangerous object key detected');
      }
      sanitized[key] = sanitizeInput(input[key], depth + 1);
    }
    return sanitized;
  }

  return input;
}

// Secure API exposure
const electronAPI = {
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
  }
};

// Safely expose API via contextBridge
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript type definitions export (compile-time only)
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
  file: {
    openInEditor: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    checkExists: (filePath: string) => Promise<boolean>;
  };
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  };
}

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