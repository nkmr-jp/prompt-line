/**
 * Default settings for Prompt Line
 *
 * This is the SINGLE SOURCE OF TRUTH for all default settings.
 *
 * Used by:
 * - app-config.ts (application configuration)
 * - settings-manager.ts (runtime defaults)
 * - generate-settings-example.ts (settings.example.yml generation)
 *
 * IMPORTANT: defaultSettings = runtime defaults = settings.example.yml active values
 * This ensures no discrepancy between what users see and what they get.
 *
 * When modifying defaults:
 * 1. Update this file
 * 2. Run: pnpm run generate:settings-example
 * 3. Commit both this file and settings.example.yml
 *
 * Configuration file location: ~/.prompt-line/settings.yml
 * The settings file is auto-created on first launch with these defaults.
 * Edit the YAML file directly to customize — changes are hot-reloaded (300ms debounce).
 */

import type { UserSettings } from '../types';

/**
 * Default settings - the single source of truth
 *
 * These are:
 * - The actual runtime defaults when user has no settings.yml
 * - The active (non-commented) values in settings.example.yml
 *
 * Settings file: ~/.prompt-line/settings.yml (YAML format, auto-created on first launch)
 * Hot reload: File changes are automatically detected and applied without restarting the app.
 */
export const defaultSettings: UserSettings = {
  /**
   * Keyboard shortcuts configuration
   *
   * Format: Modifier+Key (e.g., "Cmd+Shift+Space", "Ctrl+Alt+Space")
   * Available modifiers: Cmd, Ctrl, Alt, Shift
   *
   * Example (settings.yml):
   *   shortcuts:
   *     main: Cmd+Shift+Space
   *     paste: Cmd+Enter
   */
  shortcuts: {
    main: 'Cmd+Shift+Space',   // Show/hide the input window (global hotkey)
    paste: 'Cmd+Enter',        // Paste text to previous app and close window
    close: 'Escape',           // Close window without pasting (draft is preserved)
    historyNext: 'Ctrl+j',     // Navigate to next (older) history item
    historyPrev: 'Ctrl+k',     // Navigate to previous (newer) history item
    search: 'Cmd+f'            // Toggle search mode in history list
  },
  /**
   * Window appearance and positioning
   *
   * position options:
   *   - 'active-text-field': Near the focused text field (default, falls back to active-window-center)
   *   - 'active-window-center': Center within the currently active window
   *   - 'cursor': At the current mouse cursor location
   *   - 'center': Center on primary display
   *
   * Example (settings.yml):
   *   window:
   *     position: cursor
   *     width: 800
   *     height: 400
   */
  window: {
    position: 'active-text-field', // Window positioning mode
    width: 640,                    // Window width in pixels (recommended: 400-800)
    height: 320                    // Window height in pixels (recommended: 200-400)
  },
  /**
   * File opener settings — configure which app opens each file type
   *
   * extensions: Map of file extension → application name (overrides defaultEditor and directories)
   * directories: Array of { path, editor } entries with glob support (overrides defaultEditor)
   *   - path supports ~ for home, * (single level), ** (multiple levels)
   *   - Most specific pattern (longest non-glob prefix) wins
   * defaultEditor: Fallback editor for all files (null = system default via macOS "open" command)
   *
   * Priority: extensions > directories > defaultEditor > system default
   *
   * Example (settings.yml):
   *   fileOpener:
   *     defaultEditor: "Visual Studio Code"
   *     extensions:
   *       pdf: "Preview"
   *     directories:
   *       - path: "~/ghq/github.com/my-org/my-go*"
   *         editor: "GoLand"
   */
  fileOpener: {
    extensions: {
      png: 'Preview',
      pdf: 'Preview'
    },
    defaultEditor: null // null = use system default application
  },
  /**
   * Agent built-in slash commands to enable (type "/" to access)
   * @deprecated Use plugins setting instead. Agent built-in commands are now managed as plugins
   * under plugins/prompt-line-plugin/<tool>/agent-built-in/.
   */
  // Not set: disabled by default. Use plugins setting instead.
  /**
   * Agent skills — custom slash commands loaded from markdown files (type "/" to access)
   * @deprecated Use plugins setting instead. Kept for backward compatibility.
   * Inline entries here are merged with plugin file entries.
   *
   * Example (settings.yml):
   *   agentSkills:
   *     - name: "{basename}"
   *       description: "{frontmatter@description}"
   *       path: ~/.claude/commands
   *       pattern: "*.md"
   */
  agentSkills: [] as Array<{
    name: string;
    description: string;
    path: string;
    pattern: string;
    [key: string]: unknown;
  }>,
  /**
   * File search settings — triggered by typing "@" in the input
   *
   * Requires: fd command (brew install fd)
   * Usage: Type "@" followed by a file path to search and insert file references.
   *
   * Example (settings.yml):
   *   fileSearch:
   *     respectGitignore: true
   *     includeHidden: false
   *     maxFiles: 10000
   *     maxDepth: 5
   *     followSymlinks: true
   *     includePatterns:
   *       - "*.log"
   *       - "dist/**"
   *     excludePatterns:
   *       - "node_modules"
   *       - "*.min.js"
   */
  fileSearch: {
    respectGitignore: true,  // Respect .gitignore rules (fd only)
    includeHidden: true,     // Include hidden files (starting with .)
    maxFiles: 5000,          // Maximum number of files to index
    maxDepth: null,          // Directory depth limit (null = unlimited)
    maxSuggestions: 50,      // Max suggestions shown in popup
    followSymlinks: false,   // Follow symbolic links during search
    includePatterns: [],     // Force include patterns even if in .gitignore (glob syntax)
    excludePatterns: []      // Additional exclude patterns (glob syntax)
  },
  /**
   * Symbol search settings — triggered by typing "@lang:query" (e.g., @ts:Config, @go:Handler)
   *
   * Search: Space-separated keywords enable AND search (e.g., @ts:Config util)
   * Requires: ripgrep (brew install ripgrep)
   * Supported languages (20): go, ts, tsx, js, jsx, py, rs, java, kt, swift,
   *   rb, cpp, c, sh, make/mk, php, cs, scala, tf/terraform, md/markdown
   *
   * Example (settings.yml):
   *   symbolSearch:
   *     maxSymbols: 100000
   *     timeout: 30000
   *     includePatterns:
   *       - "*.test.ts"
   *     excludePatterns:
   *       - "*.generated.go"
   */
  symbolSearch: {
    maxSymbols: 200000,    // Maximum number of symbols to index per directory
    timeout: 60000,        // Search timeout in milliseconds
    includePatterns: [],   // Force include file patterns (glob syntax)
    excludePatterns: []    // Additional exclude file patterns (glob syntax)
  },
  /**
   * Plugin entries to enable (paths relative to ~/.prompt-line/plugins/, without .yml extension)
   * Comment out entries to disable them.
   *
   * Directory determines the plugin type:
   *   - .../agent-skills/  → Slash commands (type: command, triggered by "/")
   *   - .../custom-search/ → Mention search (type: mention, triggered by "@prefix:")
   *   - .../agent-built-in/ → Agent built-in tool commands (triggered by "/")
   *
   * Example (settings.yml):
   *   plugins:
   *     - prompt-line-plugin/claude/agent-skills/commands
   *     - prompt-line-plugin/claude/custom-search/agents
   *     - prompt-line-plugin/claude/agent-built-in/claude
   *     # - prompt-line-plugin/codex/agent-built-in/codex   # disabled
   */
  plugins: [] as string[],
  /**
   * Custom search entries — triggered by typing "@prefix:" (e.g., @agent:, @plan:)
   * @deprecated Use plugins setting instead. Kept for backward compatibility.
   * Inline entries here are merged with plugin file entries.
   *
   * Example (settings.yml):
   *   customSearch:
   *     - name: "{basename}"
   *       description: "{frontmatter@title}"
   *       path: /path/to/knowledge-base
   *       pattern: "**{/}*.md"
   *       searchPrefix: kb
   */
  customSearch: [] as Array<{
    name: string;
    description: string;
    path: string;
    pattern: string;
    [key: string]: unknown;
  }>
};

/**
 * Additional example entries shown as comments in settings.example.yml
 *
 * These are NOT runtime defaults — they are just examples to help users
 * understand available options. They appear as commented-out lines (# ...)
 * in the generated settings.example.yml file.
 *
 * To use these examples, uncomment them in ~/.prompt-line/settings.yml.
 */
export const commentedExamples = {
  agentBuiltIn: [] as string[],
  agentSkills: [] as Array<{
    name: string;
    description: string;
    path: string;
    pattern: string;
    argumentHint?: string;
  }>,
  fileOpener: {
    extensions: {
      go: 'Goland',
      md: 'Typora'
    },
    directories: [
      { path: '~/ghq/github.com/my-org/my-go*', editor: 'GoLand' }
    ]
  },
  customSearch: [
    {
      name: '{basename}',
      description: '{frontmatter@title}',
      path: '/path/to/knowledge-base',
      pattern: '**/*/*.md',
      searchPrefix: 'kb',
      shortcut: 'Ctrl+g',
      maxSuggestions: 100,
      orderBy: '{updatedAt} desc',
      inputFormat: '{filepath}',
      command: "open -a 'Google Chrome' {filepath}"
    },
    {
      name: '{json@display}',
      icon: 'history',
      color: 'orange',
      description: '',
      searchPrefix: 'r',
      path: '~/.claude',
      pattern: 'history.jsonl',
      orderBy: '{json@timestamp} desc',
      inputFormat: '{json@display}',
      displayTime: '{json@timestamp}',
      maxSuggestions: 100
    },
    {
      _comment: 'ghq Repository\nadd .zshrc (ghq list > ~/.prompt-line/ghq.txt)',
      name: '{line}',
      icon: 'repo',
      color: 'rose',
      description: '',
      searchPrefix: 'ghq',
      shortcut: 'Ctrl+g',
      command: 'open -a iTerm ~/ghq/{line}',
      path: '~/.prompt-line',
      pattern: 'ghq.txt',
      inputFormat: '~/ghq/{line}',
      maxSuggestions: 100
    }
  ]
};
