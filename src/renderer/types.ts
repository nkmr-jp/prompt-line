// Browser environment - use global require with typed interface
export interface IpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
}

export interface ElectronWindow extends Window {
  require: (module: string) => { ipcRenderer: IpcRenderer };
}

export interface HistoryItem {
  text: string;
  timestamp: number;
  id: string;
  appName?: string;
}

export interface AppInfo {
  name: string;
  bundleId?: string | null;
}

export interface UserSettings {
  shortcuts: {
    main: string;
    paste: string;
    close: string;
    historyNext: string;
    historyPrev: string;
    search: string;
  };
  window: {
    position: string;
    width: number;
    height: number;
  };
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface DirectoryInfo {
  success?: boolean;
  directory?: string;
  files?: FileInfo[];
  fileCount?: number;
  error?: string;
  partial?: boolean;          // true for Stage 1 (quick), false for Stage 2 (recursive)
  searchMode?: 'quick' | 'recursive';
  usedFd?: boolean;           // true if fd command was used
}

export interface WindowData {
  sourceApp?: AppInfo | string | null;
  history?: HistoryItem[];
  draft?: string | { text: string } | null;
  settings?: UserSettings;
  directoryData?: DirectoryInfo;
}

export interface Config {
  draft?: {
    saveDelay?: number;
  };
}

export interface PasteResult {
  success: boolean;
  error?: string;
  warning?: string;
}

export interface ImageResult {
  success: boolean;
  path?: string;
  error?: string;
}

declare global {
  interface Window {
    promptLineRenderer: PromptLineRenderer;
  }
}

// Re-export for backwards compatibility
export interface PromptLineRenderer {
  getCurrentText(): string;
  setText(text: string): void;
  clearText(): void;
  focus(): void;
}