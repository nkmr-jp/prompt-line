/**
 * Script to generate settings.example.yml from shared settings
 *
 * This ensures settings.example.yml stays in sync with the values
 * defined in config/default-settings.ts (single source of truth)
 *
 * Usage: npx ts-node scripts/generate-settings-example.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Import shared settings (single source of truth)
import { defaultSettings, commentedExamples } from '../src/config/default-settings';

// Import types
import type {
  UserSettings,
  MentionEntry,
  SlashCommandEntry
} from '../src/types';

/**
 * Format a value for YAML output
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value) && value.length === 0) return '[]';
  return String(value);
}

/**
 * Format an MdSearch entry as YAML
 */
function formatMdSearchEntry(entry: MentionEntry, indent: string, commented = false): string {
  const prefix = commented ? '#' : '';
  const lines = [
    `${prefix}${indent}- name: "${entry.name}"`,
    `${prefix}${indent}  description: "${entry.description}"`,
    `${prefix}${indent}  path: ${entry.path}`,
    `${prefix}${indent}  pattern: "${entry.pattern}"`
  ];

  if (entry.searchPrefix) {
    lines.push(`${prefix}${indent}  searchPrefix: ${entry.searchPrefix}            # Search with @${entry.searchPrefix}:`);
  }
  if (entry.maxSuggestions !== undefined) {
    lines.push(`${prefix}${indent}  maxSuggestions: ${entry.maxSuggestions}`);
  }
  if (entry.sortOrder !== undefined) {
    lines.push(`${prefix}${indent}  sortOrder: ${entry.sortOrder}`);
  }
  if (entry.inputFormat !== undefined) {
    lines.push(`${prefix}${indent}  inputFormat: ${entry.inputFormat}               # Insert file path instead of name`);
  }

  return lines.join('\n');
}

/**
 * Format a custom slash command entry as YAML
 */
function formatSlashCommandEntry(entry: SlashCommandEntry, indent: string): string {
  const lines = [
    `${indent}- name: "${entry.name}"`,
    `${indent}  description: "${entry.description}"`,
    `${indent}  path: ${entry.path}`,
    `${indent}  pattern: "${entry.pattern}"`
  ];

  if (entry.argumentHint) {
    lines.push(`${indent}  argumentHint: "${entry.argumentHint}"`);
  }
  if (entry.maxSuggestions !== undefined) {
    lines.push(`${indent}  maxSuggestions: ${entry.maxSuggestions}`);
  }

  return lines.join('\n');
}

/**
 * Generate settings.example.yml content from settings objects
 */
function generateSettingsExample(settings: UserSettings): string {
  const s = settings;
  const fileSearch = s.mentions?.fileSearch;
  const symbolSearch = s.mentions?.symbolSearch;

  // Build extensions section
  const buildExtensionsSection = (): string => {
    const extensions = s.fileOpener?.extensions || {};
    const commented = commentedExamples.fileOpener?.extensions || {};

    let section = 'extensions:                       # Extension-specific apps (uncomment to enable)\n';

    // Active extensions
    for (const [ext, app] of Object.entries(extensions)) {
      section += `    ${ext}: "${app}"\n`;
    }

    // Commented extensions
    for (const [ext, app] of Object.entries(commented)) {
      section += `  #  ${ext}: "${app}"\n`;
    }

    return section.trimEnd();
  };

  // Build slashCommands section
  const buildSlashCommandsSection = (): string => {
    let section = 'slashCommands:\n';

    // Built-in section
    section += '  # Built-in commands (Claude, Codex, Gemini, etc.)\n';
    section += '  builtIn:                            # List of tools to enable\n';

    const builtIn = s.slashCommands?.builtIn || [];
    for (const cmd of builtIn) {
      section += `    - ${cmd}\n`;
    }

    const commentedBuiltIn = commentedExamples.slashCommands?.builtIn || [];
    for (const cmd of commentedBuiltIn) {
      section += `#    - ${cmd}\n`;
    }

    // Custom section
    section += '\n  # Custom slash commands from markdown files\n';
    section += '  custom:\n';

    const custom = s.slashCommands?.custom || [];
    for (const entry of custom) {
      section += formatSlashCommandEntry(entry, '    ') + '\n';
    }

    return section.trimEnd();
  };

  // Build mentions section
  const buildMentionsSection = (): string => {
    let section = 'mentions:\n';

    // File search subsection
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
    respectGitignore: ${formatValue(fileSearch?.respectGitignore)}           # Respect .gitignore files
    includeHidden: ${formatValue(fileSearch?.includeHidden)}              # Include hidden files
    maxFiles: ${formatValue(fileSearch?.maxFiles)}                   # Maximum files to return
    maxDepth: ${formatValue(fileSearch?.maxDepth)}                   # Directory depth (null = unlimited)
    maxSuggestions: ${formatValue(fileSearch?.maxSuggestions)}               # Suggestions to show
    followSymlinks: ${formatValue(fileSearch?.followSymlinks)}            # Follow symbolic links
    #fdPath: null                    # Custom path to fd
    # Include patterns: Force include files even if in .gitignore (default: [])
    # Example: includePatterns: ["*.log", "dist/**"]
    includePatterns: ${formatValue(fileSearch?.includePatterns)}
    # Exclude patterns: Additional patterns to exclude (default: [])
    # Example: excludePatterns: ["node_modules", "*.min.js", "coverage/**"]
    excludePatterns: ${formatValue(fileSearch?.excludePatterns)}
`;

    // Symbol search subsection
    section += `
  # Symbol search settings (@ts:Config, @go:Handler)
  # Note: ripgrep required (brew install ripgrep)
  symbolSearch:
    maxSymbols: ${formatValue(symbolSearch?.maxSymbols)}                # Maximum symbols to return
    timeout: ${formatValue(symbolSearch?.timeout)}                    # Search timeout in ms
    #rgPath: null                    # Custom path to rg
`;

    // Markdown search subsection
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
`;

    // Active mdSearch entries
    const mdSearch = s.mentions?.mdSearch || [];
    for (const entry of mdSearch) {
      section += formatMdSearchEntry(entry, '    ') + '\n\n';
    }

    // Commented mdSearch entries
    const commentedMdSearch = commentedExamples.mentions?.mdSearch || [];
    for (const entry of commentedMdSearch) {
      section += formatMdSearchEntry(entry as MentionEntry, '    ', true) + '\n#\n';
    }

    return section.trimEnd();
  };

  return `# Prompt Line Settings Configuration
# This file is automatically generated but can be manually edited

# ============================================================================
# KEYBOARD SHORTCUTS
# ============================================================================
# Format: Modifier+Key (e.g., Cmd+Shift+Space, Ctrl+Alt+Space)
# Available modifiers: Cmd, Ctrl, Alt, Shift

shortcuts:
  main: ${s.shortcuts.main}           # Show/hide the input window (global)
  paste: ${s.shortcuts.paste}         # Paste text and close window
  close: ${s.shortcuts.close}              # Close window without pasting
  historyNext: ${s.shortcuts.historyNext}          # Navigate to next history item
  historyPrev: ${s.shortcuts.historyPrev}          # Navigate to previous history item
  search: ${s.shortcuts.search}            # Enable search mode in history

# ============================================================================
# WINDOW SETTINGS
# ============================================================================
# Position options:
#   - active-text-field: Near focused text field (default, falls back to active-window-center)
#   - active-window-center: Center within active window
#   - cursor: At mouse cursor location
#   - center: Center on primary display

window:
  position: ${s.window.position}
  width: ${s.window.width}                      # Recommended: 400-800 pixels
  height: ${s.window.height}                     # Recommended: 200-400 pixels

# ============================================================================
# FILE OPENER SETTINGS
# ============================================================================
# Configure which applications to use when opening file links
# When defaultEditor is null, system default application is used

fileOpener:
  # Default editor for all files (null = use system default application)
  # Example values: "Visual Studio Code", "Sublime Text", "WebStorm"
  defaultEditor: ${s.fileOpener?.defaultEditor === null || s.fileOpener?.defaultEditor === undefined ? 'null' : `"${s.fileOpener.defaultEditor}"`}
  # Extension-specific applications (overrides defaultEditor)
  ${buildExtensionsSection()}

# ============================================================================
# SLASH COMMAND SETTINGS
# ============================================================================
# Configure slash commands (/) for quick actions
# Template variables: {basename}, {frontmatter@fieldName}

${buildSlashCommandsSection()}

# ============================================================================
# MENTION SETTINGS (@ mentions)
# ============================================================================
# Configure @ mention sources: fileSearch, symbolSearch, mdSearch
# Template variables for mdSearch: {basename}, {frontmatter@fieldName}

${buildMentionsSection()}
`;
}

// Generate and write settings.example.yml
const outputPath = path.join(__dirname, '..', 'settings.example.yml');
const content = generateSettingsExample(defaultSettings);

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Generated: ${outputPath}`);
