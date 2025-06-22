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
  'window-shown'  // 🆕 ウィンドウ表示イベント
];

// IPCチャンネルの検証
function validateChannel(channel: string): boolean {
  return ALLOWED_CHANNELS.includes(channel);
}

// 安全なAPI公開
const electronAPI = {
  // IPC通信（チャンネル制限付き）
  invoke: async (channel: string, ...args: any[]): Promise<any> => {
    if (!validateChannel(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }
    
    try {
      return await ipcRenderer.invoke(channel, ...args);
    } catch (error) {
      console.error(`IPC invoke error on channel ${channel}:`, error);
      throw error;
    }
  },

  // イベントリスナー（制限付き）
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

  // イベントリスナー削除
  removeAllListeners: (channel: string): void => {
    if (!validateChannel(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }
    ipcRenderer.removeAllListeners(channel);
  },

  // クリップボード操作
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

  // ウィンドウ制御
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

  // 設定管理
  config: {
    get: async (section: string): Promise<any> => {
      if (section === '') {
        // 全設定取得の場合
        return ipcRenderer.invoke('get-config');
      }
      return ipcRenderer.invoke('get-config', section);
    },
    set: async (section: string, value: any): Promise<void> => {
      return ipcRenderer.invoke('set-config', section, value);
    }
  },

  // アプリケーション情報
  app: {
    getVersion: async (): Promise<string> => {
      return ipcRenderer.invoke('get-app-version');
    },
    getInfo: async (): Promise<any> => {
      return ipcRenderer.invoke('get-app-info');
    }
  },

  // テキスト貼り付け（メイン機能）
  pasteText: async (text: string): Promise<any> => {
    return ipcRenderer.invoke('paste-text', text);
  },

  // 履歴管理
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

  // 下書き管理
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

// contextBridge経由で安全にAPIを公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript型定義のエクスポート（コンパイル時のみ）
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

// グローバル型定義
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