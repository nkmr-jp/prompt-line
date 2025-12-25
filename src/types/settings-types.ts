import type { StartupPosition } from './window-types.js';
import type { InputFormatType, MdSearchEntry } from './mdsearch-types.js';

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
    position: StartupPosition;
    width: number;
    height: number;
  };
  commands?: {
    directories: string[];
  };
  agents?: {
    directories: string[];
  };
  fileSearch?: {
    // Respect .gitignore files (fd only, default: true)
    respectGitignore?: boolean;
    // Additional exclude patterns (applied on top of .gitignore)
    excludePatterns?: string[];
    // Include patterns (force include even if in .gitignore)
    includePatterns?: string[];
    // Maximum number of files to return (default: 5000)
    maxFiles?: number;
    // Include hidden files (starting with .)
    includeHidden?: boolean;
    // Maximum directory depth (null = unlimited)
    maxDepth?: number | null;
    // Follow symbolic links (default: false)
    followSymlinks?: boolean;
    // Custom path to fd command (null = auto-detect from common paths)
    fdPath?: string | null;
    // Input format for file path expansion (default: 'path')
    // 'name': insert only the file name (e.g., "config.ts")
    // 'path': insert the relative path (e.g., "src/config.ts")
    inputFormat?: InputFormatType;
    // Maximum number of suggestions to show (default: 50)
    maxSuggestions?: number;
  };
  fileOpener?: {
    // Extension-specific application settings (e.g., { "ts": "WebStorm", "md": "Typora" })
    extensions?: Record<string, string>;
    // Default editor when no extension-specific setting exists
    defaultEditor?: string | null;
  };
  // Symbol search configuration (code search with @<language>:<query> syntax)
  symbolSearch?: {
    // Maximum number of symbols to return (default: 20000)
    maxSymbols?: number;
    // Search timeout in milliseconds (default: 5000)
    timeout?: number;
    // Custom paths to ripgrep command (null = auto-detect from common paths)
    rgPaths?: string[] | null;
  };
  // mdSearch configuration (unified command and mention loading)
  mdSearch?: MdSearchEntry[];
}
