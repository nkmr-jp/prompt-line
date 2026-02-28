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
   * extensions: Map of file extension → application name (overrides defaultEditor)
   * defaultEditor: Fallback editor for all files (null = system default via macOS "open" command)
   *
   * Example (settings.yml):
   *   fileOpener:
   *     defaultEditor: "Visual Studio Code"
   *     extensions:
   *       ts: "WebStorm"
   *       md: "Typora"
   *       go: "Goland"
   *       pdf: "Preview"
   */
  fileOpener: {
    extensions: {
      png: 'Preview',
      pdf: 'Preview'
    },
    defaultEditor: null // null = use system default application
  },
  /**
   * Built-in slash commands to enable (type "/" to access)
   *
   * Each entry corresponds to a tool's built-in command YAML in ~/.prompt-line/built-in-commands/
   * Available: 'claude', 'openclaw', 'codex', 'gemini', etc.
   *
   * Example (settings.yml):
   *   builtInCommands:
   *     - claude
   *     - codex
   *     - gemini
   */
  builtInCommands: ['claude'],
  /**
   * Agent skills — custom slash commands loaded from markdown files (type "/" to access)
   *
   * Each entry defines a source directory and pattern to scan for skill files.
   * Template variables for name/description:
   *   {basename}              — File name without extension
   *   {frontmatter@field}     — YAML frontmatter field value (e.g., {frontmatter@description})
   *   {prefix}                — Prefix extracted via prefixPattern
   *   {dirname}               — Parent directory name
   *   {dirname:N}             — N levels up directory name (e.g., {dirname:2} = grandparent)
   *
   * Configuration fields:
   *   name            — Display name template
   *   description     — Description template
   *   path            — Directory path to scan (supports ~ for home)
   *   pattern         — Glob pattern to match files (e.g., "*.md", "SKILL.md in subdirs")
   *   label           — UI badge label (e.g., "command", "skill")
   *   color           — Badge color (name or hex, e.g., "purple", "#FF5733")
   *                     Names: grey, darkGrey, slate, stone, red, rose, orange, amber, yellow, lime, green,
   *                            emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink
   *   icon            — Codicon icon name (e.g., "agent", "rocket", "terminal")
   *                     See: https://microsoft.github.io/vscode-codicons/dist/codicon.html
   *   prefixPattern   — Pattern to extract prefix from plugin metadata JSON
   *   argumentHint    — Hint text for skill arguments
   *   maxSuggestions  — Max number of suggestions to display
   *
   * Example (settings.yml):
   *   agentSkills:
   *     - name: "{basename}"
   *       description: "{frontmatter@description}"
   *       path: ~/.claude/commands
   *       label: "command"
   *       color: "purple"
   *       pattern: "*.md"
   *       maxSuggestions: 20
   */
  agentSkills: [
    // Claude Code custom commands (from ~/.claude/commands/*.md)
    {
      name: '{basename}',
      description: '{frontmatter@description}',
      path: '~/.claude/commands',
      label: 'command',
      color: 'purple',
      pattern: '*.md',
      argumentHint: '{frontmatter@argument-hint}',
      maxSuggestions: 20
    },
    // Claude Code skills (from ~/.claude/skills/**/SKILL.md)
    {
      name: '{frontmatter@name}',
      description: '{frontmatter@description}',
      path: '~/.claude/skills',
      label: 'skill',
      color: 'pink',
      pattern: '**/*/SKILL.md',
      maxSuggestions: 20
    },
    // Plugin commands (from ~/.claude/plugins/cache/**/commands/*.md)
    {
      name: '{prefix}:{basename}',
      description: '{frontmatter@description}',
      path: '~/.claude/plugins/cache',
      pattern: '**/commands/*.md',
      prefixPattern: '**/.claude-plugin/*.json@name',
      label: 'plugin command',
      color: 'green',
      argumentHint: '{frontmatter@argument-hint}',
      maxSuggestions: 20
    },
    // Plugin skills (from ~/.claude/plugins/cache/**/SKILL.md)
    {
      name: '{prefix}:{frontmatter@name}',
      description: '{frontmatter@description}',
      path: '~/.claude/plugins/cache',
      pattern: '**/*/SKILL.md',
      prefixPattern: '**/.claude-plugin/*.json@name',
      label: 'plugin skill',
      color: 'cyan',
      argumentHint: '{frontmatter@argument-hint}',
      maxSuggestions: 20
    }
  ],
  /**
   * Mention settings — @ mention sources for file search, symbol search, and custom search
   *
   * Three sub-sections:
   *   fileSearch    — @path/to/file completion (requires fd: brew install fd)
   *   symbolSearch  — @lang:query code symbol search (requires ripgrep: brew install ripgrep)
   *   customSearch  — @prefix: custom mention sources from markdown/JSON files
   *
   * Example (settings.yml):
   *   mentions:
   *     fileSearch:
   *       maxFiles: 10000
   *     symbolSearch:
   *       timeout: 30000
   *     customSearch:
   *       - name: "{basename}"
   *         description: "{frontmatter@description}"
   *         path: ~/my-notes
   *         pattern: "*.md"
   *         searchPrefix: note
   */
  mentions: {
    /**
     * File search settings — triggered by typing "@" in the input
     *
     * Requires: fd command (brew install fd)
     * Usage: Type "@" followed by a file path to search and insert file references.
     *
     * Example (settings.yml):
     *   mentions:
     *     fileSearch:
     *       respectGitignore: true
     *       includeHidden: false
     *       maxFiles: 10000
     *       maxDepth: 5
     *       followSymlinks: true
     *       includePatterns:
     *         - "*.log"
     *         - "dist/**"
     *       excludePatterns:
     *         - "node_modules"
     *         - "*.min.js"
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
     * Requires: ripgrep (brew install ripgrep)
     * Supported languages (20): go, ts, tsx, js, jsx, py, rs, java, kt, swift,
     *   rb, cpp, c, sh, make/mk, php, cs, scala, tf/terraform, md/markdown
     *
     * Example (settings.yml):
     *   mentions:
     *     symbolSearch:
     *       maxSymbols: 100000
     *       timeout: 30000
     *       includePatterns:
     *         - "*.test.ts"
     *       excludePatterns:
     *         - "*.generated.go"
     */
    symbolSearch: {
      maxSymbols: 200000,    // Maximum number of symbols to index per directory
      timeout: 60000,        // Search timeout in milliseconds
      includePatterns: [],   // Force include file patterns (glob syntax)
      excludePatterns: []    // Additional exclude file patterns (glob syntax)
    },
    /**
     * Custom search entries — triggered by typing "@prefix:" (e.g., @agent:, @plan:)
     *
     * Each entry scans a directory for files matching a glob pattern and makes them
     * available as @ mention suggestions.
     *
     * Template variables for name/description:
     *   {basename}              — File name without extension
     *   {frontmatter@field}     — YAML frontmatter field from markdown files
     *   {json@field}            — JSON field value (for .json/.jsonl files)
     *   {json:N@field}          — JSON field from N-th level array item
     *   {prefix}                — Prefix extracted via prefixPattern
     *   {dirname}               — Parent directory name
     *   {dirname:N}             — N levels up directory name
     *
     * Configuration fields:
     *   name            — Display name template
     *   description     — Description template (supports "|" fallback: "{json@a}|{json@b}")
     *   path            — Directory path to scan (supports ~ for home)
     *   pattern         — Glob pattern to match files
     *                     Supports: *.md, **{/}*.md, *.json, *.jsonl
     *                     jq expressions: "config.json@.members" (expands array into items)
     *   prefixPattern   — Pattern to extract prefix from plugin metadata JSON
     *   searchPrefix    — Prefix to trigger this search (e.g., "agent" → @agent:)
     *   maxSuggestions  — Max suggestions to display
     *   orderBy         — Sort order (e.g., "name", "name desc", "{updatedAt} desc")
     *   inputFormat     — Insert format: 'name' (display name), '{filepath}' (file path), or template
     *   color           — Badge color (name or hex)
     *   icon            — Codicon icon name
     *   label           — UI badge label
     *
     * Example (settings.yml):
     *   mentions:
     *     customSearch:
     *       - name: "{basename}"
     *         description: "{frontmatter@title}"
     *         path: /path/to/knowledge-base
     *         pattern: "**{/}*.md"
     *         searchPrefix: kb
     *         maxSuggestions: 100
     *         inputFormat: "{filepath}"
     */
    customSearch: [
      // Claude Code agents (from ~/.claude/agents/*.md, search with @agent:)
      {
        name: '{basename}(agent)',
        label: "agent",
        description: '{frontmatter@description}',
        path: '~/.claude/agents',
        pattern: '*.md',
        searchPrefix: 'agent',
        displayTime: '{updatedAt}'
      },
      // Plugin agents (from ~/.claude/plugins/cache/**/agents/*.md, search with @agent:)
      {
        name: '{prefix}:{basename}(agent)',
        label: "plugin agent",
        description: '{frontmatter@description}',
        path: '~/.claude/plugins/cache',
        color: "yellow",
        pattern: '**/agents/*.md',
        prefixPattern: '**/.claude-plugin/*.json@name',
        searchPrefix: 'agent',
        displayTime: '{updatedAt}'
      },
      // Claude Code team members (from ~/.claude/teams/**/config.json, search with @team:)
      // Uses jq expression to filter teams created in last 24h with 2+ members
      {
        name: "{json@name}",
        description: "{json@prompt}|{json:1@description}",
        color: "{json@color}|#ffffff",
        icon: "organization",
        label: "{dirname}",
        path: "~/.claude/teams",
        pattern: "**/config.json@. | select(.createdAt / 1000 > (now - 86400)) | select((.members | length) >= 2) | .members",
        searchPrefix: "team",
        orderBy: "{json@joinedAt} desc",
        displayTime: "{json@joinedAt}"
      },
      // Claude Code plans (from ~/.claude/plans/*.md, search with @plan:)
      {
        name: '{basename}',
        description: '{heading}',
        path: '~/.claude/plans',
        icon: 'file-text',
        color: 'blue',
        pattern: '*.md',
        searchPrefix: 'plan',
        inputFormat: '{filepath}',
        orderBy: '{updatedAt} desc',
        displayTime: '{updatedAt}'
      },
      // Claude Code tasks (from ~/.claude/tasks/**/*.md, search with @task:)
      {
        name: '{basename}',
        label: '{dirname}',
        icon: 'tasklist',
        color: 'violet',
        description: '{heading}',
        path: '~/.claude/tasks',
        pattern: '**/*/*.md',
        searchPrefix: 'task',
        inputFormat: '{filepath}',
        orderBy: '{updatedAt} desc',
        displayTime: '{updatedAt}'
      }
    ]
  }
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
  builtInCommands: ['codex', 'gemini'],
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
    }
  },
  mentions: {
    customSearch: [
      {
        name: '{basename}',
        description: '{frontmatter@title}',
        path: '/path/to/knowledge-base',
        pattern: '**/*/*.md',
        searchPrefix: 'kb',
        maxSuggestions: 100,
        orderBy: '{updatedAt} desc',
        inputFormat: '{filepath}'
      }
    ]
  }
};
