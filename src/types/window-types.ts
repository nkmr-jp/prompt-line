import type { HistoryItem, DraftData } from './history-types.js';
import type { DirectoryInfo } from './file-search-types.js';
import type { UserSettings } from './settings-types.js';

export interface AppInfo {
  name: string;
  bundleId?: string | null;
}

export interface SpaceInfo {
  method: string;
  signature: string;
  frontmostApp?: AppInfo | string | null;
  windowCount: number;
  appCount: number;
  apps: Array<{
    name: string;
    pid: number;
    windowCount: number;
    isActive: boolean;
  }>;
}

export interface WindowData {
  sourceApp?: AppInfo | string | null;
  currentSpaceInfo?: SpaceInfo | null;
  history?: HistoryItem[];
  draft?: string | DraftData | null;
  settings?: UserSettings;
  directoryData?: DirectoryInfo;
  fileSearchEnabled?: boolean;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type StartupPosition = 'cursor' | 'center' | 'active-window-center' | 'active-text-field';

export interface WindowConfig {
  width: number;
  height: number;
  frame: boolean;
  transparent: boolean;
  backgroundColor?: string;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
  resizable: boolean;
  webPreferences: {
    nodeIntegration: boolean;
    contextIsolation: boolean;
    webSecurity: boolean;
    preload?: string;  // Preload script path
    spellcheck: boolean;
    disableDialogs: boolean;
    enableWebSQL: boolean;
    experimentalFeatures: boolean;
    defaultEncoding: string;
    offscreen: boolean;
    enablePreferredSizeMode: boolean;
    disableHtmlFullscreenWindowResize: boolean;
    allowRunningInsecureContent?: boolean;  // Security setting
    sandbox?: boolean;  // Sandbox setting
  };
}
