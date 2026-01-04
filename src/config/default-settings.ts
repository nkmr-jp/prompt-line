/**
 * Default settings for Prompt Line
 *
 * This is the single source of truth for default settings.
 * Used by:
 * - app-config.ts (application configuration)
 * - settings-manager.ts (runtime defaults)
 * - generate-settings-example.ts (settings.example.yml generation)
 *
 * When modifying defaults:
 * 1. Update this file
 * 2. Run: npm run generate:settings-example
 * 3. Commit both this file and settings.example.yml
 */

import type { UserSettings } from '../types';

/**
 * Default settings - the single source of truth
 */
export const defaultSettings: UserSettings = {
  shortcuts: {
    main: 'Cmd+Shift+Space',
    paste: 'Cmd+Enter',
    close: 'Escape',
    historyNext: 'Ctrl+j',
    historyPrev: 'Ctrl+k',
    search: 'Cmd+f'
  },
  window: {
    position: 'active-text-field',
    width: 600,
    height: 300
  },
  fileOpener: {
    extensions: {},
    defaultEditor: null
  },
  // mentions contains fileSearch, symbolSearch, mdSearch
  mentions: {
    fileSearch: {
      respectGitignore: true,
      includeHidden: true,
      maxFiles: 5000,
      maxDepth: null,
      maxSuggestions: 50,
      followSymlinks: false,
      includePatterns: [],
      excludePatterns: []
    },
    symbolSearch: {
      maxSymbols: 20000,
      timeout: 5000
    }
  }
  // slashCommands is optional - contains builtIn and custom
};
