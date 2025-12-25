/**
 * Settings comment generator
 * Generates YAML comments for settings file
 */

import type { UserSettings } from '../types';

export function addCommentsToSettings(settings: UserSettings): string {
  const fileSearchSection = buildFileSearchSection(settings.fileSearch);
  const symbolSearchSection = buildSymbolSearchSection(settings.symbolSearch);
  const extensionsSection = buildExtensionsSection(settings.fileOpener);
  const mdSearchSection = buildMdSearchSection(settings.mdSearch);

  return buildFullSettingsYaml(settings, fileSearchSection, symbolSearchSection, extensionsSection, mdSearchSection);
}

function buildFileSearchSection(fileSearch: UserSettings['fileSearch']): string {
  if (!fileSearch) {
    return buildCommentedFileSearchTemplate();
  }

  return buildActiveFileSearchSection(fileSearch);
}

function buildCommentedFileSearchTemplate(): string {
  return `#fileSearch:                        # File search for @ mentions (uncomment to enable)
#  respectGitignore: true             # Respect .gitignore files
#  includeHidden: true                # Include hidden files (starting with .)
#  maxFiles: 5000                     # Maximum files to return
#  maxDepth: null                     # Directory depth limit (null = unlimited)
#  maxSuggestions: 50                 # Maximum suggestions to show (default: 50)
#  followSymlinks: false              # Follow symbolic links
#  fdPath: null                       # Custom path to fd command (null = auto-detect)
#  #excludePatterns:                  # Additional exclude patterns
#  #  - "*.log"
#  #  - "*.tmp"
#  #includePatterns:                  # Force include patterns (override .gitignore)
#  #  - "dist/**/*.js"`;
}

function buildActiveFileSearchSection(fileSearch: NonNullable<UserSettings['fileSearch']>): string {
  const formatArrayAsList = (arr: unknown[] | undefined): string => {
    if (!arr || arr.length === 0) return '';
    return arr.map(item => `\n    - "${item}"`).join('');
  };

  const excludePatternsSection = fileSearch.excludePatterns && fileSearch.excludePatterns.length > 0
    ? `excludePatterns:${formatArrayAsList(fileSearch.excludePatterns)}  # Additional exclude patterns`
    : `#excludePatterns:                  # Additional exclude patterns (uncomment to enable)
  #  - "*.log"
  #  - "*.tmp"`;

  const includePatternsSection = fileSearch.includePatterns && fileSearch.includePatterns.length > 0
    ? `includePatterns:${formatArrayAsList(fileSearch.includePatterns)}  # Force include patterns (override .gitignore)`
    : `#includePatterns:                  # Force include patterns (uncomment to enable)
  #  - "dist/**/*.js"`;

  const fdPathSection = fileSearch.fdPath
    ? `fdPath: "${fileSearch.fdPath}"                       # Custom path to fd command`
    : `#fdPath: null                       # Custom path to fd command (null = auto-detect)`;

  return `fileSearch:
  respectGitignore: ${fileSearch.respectGitignore ?? true}    # Respect .gitignore files
  includeHidden: ${fileSearch.includeHidden ?? true}          # Include hidden files (starting with .)
  maxFiles: ${fileSearch.maxFiles ?? 5000}                    # Maximum files to return
  maxDepth: ${fileSearch.maxDepth ?? 'null'}                  # Directory depth limit (null = unlimited)
  maxSuggestions: ${fileSearch.maxSuggestions ?? 50}          # Maximum suggestions to show (default: 50)
  followSymlinks: ${fileSearch.followSymlinks ?? false}       # Follow symbolic links
  ${fdPathSection}
  ${excludePatternsSection}
  ${includePatternsSection}`;
}

function buildSymbolSearchSection(symbolSearch: UserSettings['symbolSearch']): string {
  if (!symbolSearch) {
    return buildDefaultSymbolSearchTemplate();
  }

  return buildActiveSymbolSearchSection(symbolSearch);
}

function buildDefaultSymbolSearchTemplate(): string {
  return `symbolSearch:
  maxSymbols: 20000                   # Maximum symbols to return (default: 20000)
  timeout: 5000                       # Search timeout in milliseconds (default: 5000)
  #rgPaths:                           # Custom paths to rg command (uncomment to override auto-detection)
  #  - /opt/homebrew/bin/rg
  #  - /usr/local/bin/rg`;
}

function buildActiveSymbolSearchSection(symbolSearch: NonNullable<UserSettings['symbolSearch']>): string {
  const rgPathsSection = symbolSearch.rgPaths && symbolSearch.rgPaths.length > 0
    ? `rgPaths:${symbolSearch.rgPaths.map(p => `\n    - ${p}`).join('')}`
    : `#rgPaths:                           # Custom paths to rg command (uncomment to override auto-detection)
  #  - /opt/homebrew/bin/rg
  #  - /usr/local/bin/rg`;

  return `symbolSearch:
  maxSymbols: ${symbolSearch.maxSymbols ?? 20000}                   # Maximum symbols to return (default: 20000)
  timeout: ${symbolSearch.timeout ?? 5000}                       # Search timeout in milliseconds (default: 5000)
  ${rgPathsSection}`;
}

function buildExtensionsSection(fileOpener: UserSettings['fileOpener']): string {
  const formatExtensionsAsList = (ext: Record<string, string> | undefined): string => {
    if (!ext || Object.keys(ext).length === 0) return '';
    return Object.entries(ext).map(([key, val]) => `\n    ${key}: "${val}"`).join('');
  };

  if (fileOpener?.extensions && Object.keys(fileOpener.extensions).length > 0) {
    return `extensions:${formatExtensionsAsList(fileOpener.extensions)}`;
  }

  return `#extensions:                       # Extension-specific apps (uncomment to enable)
  #  ts: "WebStorm"
  #  md: "Typora"
  #  pdf: "Preview"`;
}

function buildMdSearchSection(mdSearch: UserSettings['mdSearch']): string {
  if (!mdSearch || mdSearch.length === 0) {
    return buildCommentedMdSearchTemplate();
  }

  return `mdSearch:${formatMdSearch(mdSearch)}`;
}

function buildCommentedMdSearchTemplate(): string {
  return `#mdSearch:                         # Slash commands & mentions (uncomment to enable)
#  # Pattern examples:
#  #   "*.md"                  - Root directory only
#  #   "**/*.md"               - All subdirectories (recursive)
#  #   "**/commands/*.md"      - Any "commands" subdirectory
#  #   "**/*/SKILL.md"         - SKILL.md in any subdirectory
#  #   "**/{cmd,agent}/*.md"   - Brace expansion (cmd or agent dirs)
#  #   "test-*.md"             - Wildcard prefix
#
#  - name: "{basename}"
#    type: command                     # 'command' for / or 'mention' for @
#    description: "{frontmatter@description}"
#    path: ~/.claude/commands
#    pattern: "*.md"
#    argumentHint: "{frontmatter@argument-hint}"  # Optional hint after selection
#    maxSuggestions: 20                # Max number of suggestions (default: 20)
#    inputFormat: name                 # 'name' for name only, 'path' for file path (default: name)
#
#  - name: "agent-{basename}"
#    type: mention
#    description: "{frontmatter@description}"
#    path: ~/.claude/agents
#    pattern: "*.md"
#    maxSuggestions: 20
#    searchPrefix: "agent:"            # Require @agent: prefix for this entry (optional)
#    inputFormat: path                 # 'name' for name only, 'path' for file path
#
#  - name: "{frontmatter@name}"
#    type: mention
#    description: "{frontmatter@description}"
#    path: ~/.claude/plugins
#    pattern: "**/*/SKILL.md"          # Match SKILL.md in any plugin subdirectory
#    maxSuggestions: 20
#    searchPrefix: "skill:"            # Require @skill: prefix for this entry`;
}

function formatMdSearch(mdSearch: NonNullable<UserSettings['mdSearch']>): string {
  return '\n' + mdSearch.map(entry => `  - name: "${entry.name}"
    type: ${entry.type}
    description: "${entry.description || ''}"
    path: ${entry.path}
    pattern: "${entry.pattern}"${entry.argumentHint ? `\n    argumentHint: "${entry.argumentHint}"` : ''}
    maxSuggestions: ${entry.maxSuggestions ?? 20}${entry.searchPrefix ? `\n    searchPrefix: "${entry.searchPrefix}"` : ''}${entry.inputFormat ? `\n    inputFormat: ${entry.inputFormat}` : ''}`).join('\n');
}

function buildFullSettingsYaml(
  settings: UserSettings,
  fileSearchSection: string,
  symbolSearchSection: string,
  extensionsSection: string,
  mdSearchSection: string
): string {
  const header = buildFileHeader();
  const shortcuts = buildShortcutsSection(settings.shortcuts);
  const window = buildWindowSection(settings.window);
  const fileOpener = buildFileOpenerSection(settings.fileOpener, extensionsSection);
  const fileSearch = buildFileSearchSectionWithHeader(fileSearchSection);
  const symbolSearch = buildSymbolSearchSectionWithHeader(symbolSearchSection);
  const mdSearch = buildMdSearchSectionWithHeader(mdSearchSection);

  return [header, shortcuts, window, fileOpener, fileSearch, symbolSearch, mdSearch].join('\n');
}

function buildFileHeader(): string {
  return `# Prompt Line Settings Configuration
# This file is automatically generated but can be manually edited`;
}

function buildShortcutsSection(shortcuts: UserSettings['shortcuts']): string {
  return `
# ============================================================================
# KEYBOARD SHORTCUTS
# ============================================================================
# Format: Modifier+Key (e.g., Cmd+Shift+Space, Ctrl+Alt+Space)
# Available modifiers: Cmd, Ctrl, Alt, Shift

shortcuts:
  main: ${shortcuts.main}           # Show/hide the input window (global)
  paste: ${shortcuts.paste}         # Paste text and close window
  close: ${shortcuts.close}              # Close window without pasting
  historyNext: ${shortcuts.historyNext}          # Navigate to next history item
  historyPrev: ${shortcuts.historyPrev}          # Navigate to previous history item
  search: ${shortcuts.search}            # Enable search mode in history`;
}

function buildWindowSection(window: UserSettings['window']): string {
  return `
# ============================================================================
# WINDOW SETTINGS
# ============================================================================
# Position options:
#   - active-text-field: Near focused text field (default, falls back to active-window-center)
#   - active-window-center: Center within active window
#   - cursor: At mouse cursor location
#   - center: Center on primary display

window:
  position: ${window.position}
  width: ${window.width}                      # Recommended: 400-800 pixels
  height: ${window.height}                     # Recommended: 200-400 pixels`;
}

function buildFileOpenerSection(fileOpener: UserSettings['fileOpener'], extensionsSection: string): string {
  const defaultEditor = formatDefaultEditor(fileOpener?.defaultEditor);

  return `
# ============================================================================
# FILE OPENER SETTINGS
# ============================================================================
# Configure which applications to use when opening file links
# When defaultEditor is null, system default application is used

fileOpener:
  # Default editor for all files (null = use system default application)
  # Example values: "Visual Studio Code", "Sublime Text", "WebStorm"
  defaultEditor: ${defaultEditor}
  # Extension-specific applications (overrides defaultEditor)
  ${extensionsSection}`;
}

function formatDefaultEditor(defaultEditor: string | null | undefined): string {
  if (defaultEditor === null || defaultEditor === undefined) {
    return 'null';
  }
  return `"${defaultEditor}"`;
}

function buildFileSearchSectionWithHeader(fileSearchSection: string): string {
  return `
# ============================================================================
# FILE SEARCH SETTINGS (@ mentions)
# ============================================================================
# Note: fd command is required for file search (install: brew install fd)
# When this section is commented out, file search feature is disabled

${fileSearchSection}`;
}

function buildSymbolSearchSectionWithHeader(symbolSearchSection: string): string {
  return `
# ============================================================================
# SYMBOL SEARCH SETTINGS (Code Search)
# ============================================================================
# Configure symbol search behavior for @<language>:<query> syntax
# Note: ripgrep (rg) command is required (install: brew install ripgrep)
# Note: File search must be enabled for symbol search to work

${symbolSearchSection}`;
}

function buildMdSearchSectionWithHeader(mdSearchSection: string): string {
  return `
# ============================================================================
# MARKDOWN SEARCH SETTINGS (Slash Commands & Mentions)
# ============================================================================
# Configure sources for slash commands (/) and mentions (@)
# Template variables: {basename}, {frontmatter@fieldName}

${mdSearchSection}
`;
}
