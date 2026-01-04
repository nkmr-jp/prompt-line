/**
 * Script to generate settings.example.yml from defaultSettings
 *
 * This ensures settings.example.yml stays in sync with the default values
 * defined in settings-manager.ts
 *
 * Usage: npx ts-node scripts/generate-settings-example.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Import types
import type {
  UserSettings,
  FileSearchUserSettings,
  SymbolSearchUserSettings
} from '../src/types';

// Default settings - must match settings-manager.ts defaultSettings
const defaultSettings: UserSettings = {
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
};

/**
 * Generate settings.example.yml content with comments
 * This is a simplified version for generating the example file
 */
function generateSettingsExample(settings: UserSettings): string {
  // Get fileSearch settings from mentions.fileSearch or legacy fileSearch
  const getFileSearchSettings = (): FileSearchUserSettings | undefined => {
    return settings.mentions?.fileSearch || settings.fileSearch;
  };

  // Get symbolSearch settings from mentions.symbolSearch or legacy symbolSearch
  const getSymbolSearchSettings = (): SymbolSearchUserSettings | undefined => {
    return settings.mentions?.symbolSearch || settings.symbolSearch;
  };

  // Build extensions section (example format)
  const extensionsSection = `extensions:                       # Extension-specific apps (uncomment to enable)
    go: "Goland"
  #  md: "Typora"
  #  pdf: "Preview"`;

  // Build slashCommands section - always show with example
  const buildSlashCommandsSection = (): string => {
    // Always show with example structure for settings.example.yml
    let section = 'slashCommands:\n';

    // Built-in section with example
    section += `  # Built-in commands (Claude, Codex, Gemini, etc.)
  builtIn:                            # List of tools to enable
    - claude
#    - codex
#    - gemini`;

    // Custom section with example
    section += `

  # Custom slash commands from markdown files
  custom:
    - name: "{basename}"
      description: "{frontmatter@description}"
      path: ~/.claude/commands
      pattern: "*.md"
      argumentHint: "{frontmatter@argument-hint}"
      maxSuggestions: 20`;

    return section;
  };

  const slashCommandsSection = buildSlashCommandsSection();

  // Build unified mentions section (fileSearch, symbolSearch, mdSearch)
  const buildMentionsSection = (): string => {
    const fileSearch = getFileSearchSettings();
    const symbolSearch = getSymbolSearchSettings();

    let section = 'mentions:\n';

    // File search subsection with pattern format documentation
    section += `  # File search settings (@path/to/file completion)
  # Note: fd command required (brew install fd)
  #
  # Pattern format (glob syntax):
  #   - "*.log"           : Match all .log files
  #   - "build/**"        : Match all files in build directory
  #   - "*.{js,ts}"       : Match .js and .ts files
  #   - ".git"            : Match .git directory
  #   - "node_modules"    : Match node_modules directory
  #
  fileSearch:
    respectGitignore: ${fileSearch?.respectGitignore ?? true}           # Respect .gitignore files
    includeHidden: ${fileSearch?.includeHidden ?? true}              # Include hidden files
    maxFiles: ${fileSearch?.maxFiles ?? 5000}                   # Maximum files to return
    maxDepth: ${fileSearch?.maxDepth ?? 'null'}                   # Directory depth (null = unlimited)
    maxSuggestions: ${fileSearch?.maxSuggestions ?? 50}               # Suggestions to show
    followSymlinks: ${fileSearch?.followSymlinks ?? false}            # Follow symbolic links
    #fdPath: null                    # Custom path to fd
    # Include patterns: Force include files even if in .gitignore (default: [])
    # Example: includePatterns: ["*.log", "dist/**"]
    includePatterns: []
    # Exclude patterns: Additional patterns to exclude (default: [])
    # Example: excludePatterns: ["node_modules", "*.min.js", "coverage/**"]
    excludePatterns: []
`;

    // Symbol search subsection
    section += `
  # Symbol search settings (@ts:Config, @go:Handler)
  # Note: ripgrep required (brew install ripgrep)
  symbolSearch:
    maxSymbols: ${symbolSearch?.maxSymbols ?? 20000}                # Maximum symbols to return
    timeout: ${symbolSearch?.timeout ?? 5000}                    # Search timeout in ms
    #rgPath: null                    # Custom path to rg
`;

    // Markdown-based mentions subsection with examples
    section += `
  # Markdown-based mentions from markdown files
  # Pattern examples:
  #   "*.md"                  - Root directory only
  #   "**/*.md"               - All subdirectories (recursive)
  #   "**/commands/*.md"      - Any "commands" subdirectory
  #   "**/*/SKILL.md"         - SKILL.md in any subdirectory
  #   "**/{cmd,agent}/*.md"   - Brace expansion (cmd or agent dirs)
  #   "test-*.md"             - Wildcard prefix
  # searchPrefix: Search with @<prefix>: (e.g., searchPrefix: "agent" → @agent:)
  mdSearch:
    - name: "agent-{basename}"
      description: "{frontmatter@description}"
      path: ~/.claude/agents
      pattern: "*.md"
      searchPrefix: agent            # Search with @agent:

    - name: "{frontmatter@name}"
      description: "{frontmatter@description}"
      path: ~/.claude/skills
      pattern: "**/*/SKILL.md"
      searchPrefix: skill            # Search with @skill:

#    - name: "{frontmatter@name}"
#      description: "{frontmatter@description}"
#      path: ~/.claude/plugins
#      pattern: "**/*/SKILL.md"
#      searchPrefix: skill            # Search with @skill:
#
#    - name: "{basename}"
#      description: "{frontmatter@title}"
#      path: /path/to/knowledge-base
#      pattern: "**/*/*.md"
#      searchPrefix: kb                # Search with @kb:
#      maxSuggestions: 100
#      sortOrder: desc
#      inputFormat: path               # Insert file path instead of name
`;

    return section;
  };

  const mentionsSection = buildMentionsSection();

  return `# Prompt Line Settings Configuration
# This file is automatically generated but can be manually edited

# ============================================================================
# KEYBOARD SHORTCUTS
# ============================================================================
# Format: Modifier+Key (e.g., Cmd+Shift+Space, Ctrl+Alt+Space)
# Available modifiers: Cmd, Ctrl, Alt, Shift

shortcuts:
  main: ${settings.shortcuts.main}           # Show/hide the input window (global)
  paste: ${settings.shortcuts.paste}         # Paste text and close window
  close: ${settings.shortcuts.close}              # Close window without pasting
  historyNext: ${settings.shortcuts.historyNext}          # Navigate to next history item
  historyPrev: ${settings.shortcuts.historyPrev}          # Navigate to previous history item
  search: ${settings.shortcuts.search}            # Enable search mode in history

# ============================================================================
# WINDOW SETTINGS
# ============================================================================
# Position options:
#   - active-text-field: Near focused text field (default, falls back to active-window-center)
#   - active-window-center: Center within active window
#   - cursor: At mouse cursor location
#   - center: Center on primary display

window:
  position: ${settings.window.position}
  width: ${settings.window.width}                      # Recommended: 400-800 pixels
  height: ${settings.window.height}                     # Recommended: 200-400 pixels

# ============================================================================
# FILE OPENER SETTINGS
# ============================================================================
# Configure which applications to use when opening file links
# When defaultEditor is null, system default application is used

fileOpener:
  # Default editor for all files (null = use system default application)
  # Example values: "Visual Studio Code", "Sublime Text", "WebStorm"
  defaultEditor: ${settings.fileOpener?.defaultEditor === null || settings.fileOpener?.defaultEditor === undefined ? 'null' : `"${settings.fileOpener.defaultEditor}"`}
  # Extension-specific applications (overrides defaultEditor)
  ${extensionsSection}

# ============================================================================
# SLASH COMMAND SETTINGS
# ============================================================================
# Configure slash commands (/) for quick actions
# Template variables: {basename}, {frontmatter@fieldName}

${slashCommandsSection}

# ============================================================================
# MENTION SETTINGS (@ mentions)
# ============================================================================
# Configure @ mention sources: fileSearch, symbolSearch, mdSearch
# Template variables for mdSearch: {basename}, {frontmatter@fieldName}

${mentionsSection}`;
}

// Generate and write settings.example.yml
const outputPath = path.join(__dirname, '..', 'settings.example.yml');
const content = generateSettingsExample(defaultSettings);

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Generated: ${outputPath}`);
