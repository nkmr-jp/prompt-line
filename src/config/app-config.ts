import path from 'path';
import os from 'os';
import type {
  WindowConfig,
  ShortcutsConfig,
  PathsConfig,
  HistoryConfig,
  DraftConfig,
  TimingConfig,
  AppConfig,
  PlatformConfig,
  LoggingConfig,
  LogLevel
} from '../types';

// Import package.json to get the version dynamically
import packageJson from '../../package.json';

// Import shared default settings (single source of truth)
import { defaultSettings } from './default-settings';

class AppConfigClass {
  public window!: WindowConfig;
  public shortcuts!: ShortcutsConfig;
  public paths!: PathsConfig;
  public history!: HistoryConfig;
  public draft!: DraftConfig;
  public timing!: TimingConfig;
  public app!: AppConfig;
  public platform!: PlatformConfig;
  public logging!: LoggingConfig;

  constructor() {
    this.init();
  }

  private init(): void {
    this.window = {
      width: defaultSettings.window.width,
      height: defaultSettings.window.height,
      frame: false,
      transparent: false,
      backgroundColor: '#141414',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        // Enhanced security configuration
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        
        // Maintain existing settings
        spellcheck: false,
        disableDialogs: true,
        enableWebSQL: false,
        experimentalFeatures: false,
        defaultEncoding: 'UTF-8',
        offscreen: false,
        enablePreferredSizeMode: false,
        disableHtmlFullscreenWindowResize: true,
        
        // Additional security settings
        allowRunningInsecureContent: false,
        sandbox: true,  // Enabled for enhanced security (accessibility features work via main process)
      }
    };

    // Use shared default settings for shortcuts
    this.shortcuts = { ...defaultSettings.shortcuts };

    const userDataDir = path.join(os.homedir(), '.prompt-line');
    this.paths = {
      userDataDir,
      get historyFile() {
        return path.join(userDataDir, 'history.jsonl');
      },
      get draftFile() {
        return path.join(userDataDir, 'draft.json');
      },
      get logFile() {
        return path.join(userDataDir, 'app.log');
      },
      get imagesDir() {
        return path.join(userDataDir, 'images');
      },
      get directoryFile() {
        return path.join(userDataDir, 'directory.json');
      },
      get cacheDir() {
        return path.join(userDataDir, 'cache');
      },
      get projectsCacheDir() {
        return path.join(userDataDir, 'cache', 'projects');
      },
      get builtInCommandsDir() {
        return path.join(userDataDir, 'built-in-commands');
      }
    };

    this.history = {
      saveInterval: 1000
    };

    this.draft = {
      saveDelay: 500
    };

    this.timing = {
      windowHideDelay: 10,
      appFocusDelay: 50
    };

    this.app = {
      name: 'Prompt Line',
      version: packageJson.version,
      description: 'プロンプトラインアプリ - カーソル位置にテキストを素早く貼り付け'
    };

    this.platform = {
      isMac: process.platform === 'darwin',
      isWindows: process.platform === 'win32',
      isLinux: process.platform === 'linux'
    };

    // Determine log level based on LOG_LEVEL environment variable
    let logLevel: LogLevel = 'info'; // Default to info
    if (process.env.LOG_LEVEL === 'debug') {
      logLevel = 'debug';
    }

    this.logging = {
      level: logLevel,
      enableFileLogging: true,
      maxLogFileSize: 5 * 1024 * 1024,
      maxLogFiles: 3
    };
  }

  get<K extends keyof this>(section: K): this[K] {
    return this[section] || {} as this[K];
  }

  getValue(path: string): unknown {
    return path.split('.').reduce((obj, key) => obj && (obj as Record<string, unknown>)[key], this as unknown);
  }

  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  getInputHtmlPath(): string {
    // In production, HTML file is copied to dist/renderer directory
    // __dirname is dist/config
    return path.join(__dirname, '..', 'renderer', 'input.html');
  }
}

export default new AppConfigClass();