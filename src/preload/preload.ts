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
  'hide-window',
  'show-window',
  'get-config',
  'set-config',
  'get-app-info',
  'get-app-version',
  'clipboard-write-text',
  'clipboard-read-text',
  'clipboard-write-image',
  'focus-window',
  'window-shown'
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

// Input sanitization helper
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Prevent excessive length
    if (input.length > 1000000) { // 1MB limit
      throw new Error('Input too long');
    }
    
    // Basic sanitization
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  
  if (typeof input === 'object' && input !== null) {
    // Prevent prototype pollution
    if (Object.prototype.hasOwnProperty.call(input, '__proto__') || 
        Object.prototype.hasOwnProperty.call(input, 'constructor') || 
        Object.prototype.hasOwnProperty.call(input, 'prototype')) {
      throw new Error('Potentially dangerous object properties detected');
    }
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

  // Clipboard operations
  clipboard: {
    writeText: async (text: string): Promise<void> => {
      return ipcRenderer.invoke('clipboard-write-text', text);
    },
    readText: async (): Promise<string> => {
      return ipcRenderer.invoke('clipboard-read-text');
    },
    writeImage: async (image: any): Promise<void> => {
      return ipcRenderer.invoke('clipboard-write-image', image);
    }
  },

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
    },
    set: async (section: string, value: any): Promise<void> => {
      return ipcRenderer.invoke('set-config', section, value);
    }
  },

  // Application information
  app: {
    getVersion: async (): Promise<string> => {
      return ipcRenderer.invoke('get-app-version');
    },
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
  clipboard: {
    writeText: (text: string) => Promise<void>;
    readText: () => Promise<string>;
    writeImage: (image: any) => Promise<void>;
  };
  window: {
    hide: () => Promise<void>;
    show: () => Promise<void>;
    focus: () => Promise<void>;
  };
  config: {
    get: (section: string) => Promise<any>;
    set: (section: string, value: any) => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
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