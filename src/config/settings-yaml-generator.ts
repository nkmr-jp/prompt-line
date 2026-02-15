/**
 * Unified YAML generator for settings files
 *
 * This module provides a single source of truth for generating YAML output.
 * Used by both:
 * - settings-manager.ts (runtime settings saving)
 * - generate-settings-example.ts (example file generation)
 *
 * This eliminates the discrepancy between runtime-saved settings and example files.
 */

import type {
  UserSettings,
  MentionEntry,
  SlashCommandEntry,
  FileSearchUserSettings,
  SymbolSearchUserSettings
} from '../types';
import { commentedExamples } from './default-settings';
import { logger } from '../utils/utils';

/**
 * Options for YAML generation
 */
export interface YamlGeneratorOptions {
  /**
   * Include additional commented examples from commentedExamples
   * Used for settings.example.yml generation
   */
  includeCommentedExamples?: boolean;
}

/**
 * Format a value for YAML output
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';

    // Handle non-empty arrays - should be simple string arrays in this context
    // Validate that all elements are strings
    const hasNonStringElements = value.some(item => typeof item !== 'string');
    if (hasNonStringElements) {
      logger.warn('[settings-yaml-generator] Unexpected non-string array elements detected', { value });
      // Return safe fallback for unexpected complex values
      return '[]';
    }

    // Format as YAML array with proper indentation
    // This is used in context like:
    //     includePatterns: ${formatValue(fs.includePatterns)}
    // Where base indentation is 4 spaces, so we need 6 spaces for list items (4 + 2)
    // Example output:
    //     includePatterns:
    //       - "*.log"
    //       - "dist/**"
    return '\n' + value.map(item => `      - "${item}"`).join('\n');
  }

  // Unexpected value type - log warning and return safe fallback
  logger.warn('[settings-yaml-generator] Unexpected value type in formatValue', { type: typeof value, value });
  return 'null';
}

/**
 * Format extensions object as YAML
 */
function formatExtensionsAsList(ext: Record<string, string> | undefined): string {
  if (!ext || Object.keys(ext).length === 0) return '';
  return Object.entries(ext).map(([key, val]) => `\n    ${key}: "${val}"`).join('');
}

/**
 * Format an agent skill entry as YAML
 */
function formatAgentSkillEntry(entry: SlashCommandEntry, indent: string, commented = false): string {
  // When commented, use indent + "# " prefix
  // Active:    "  - name:" (indent + -)
  // Commented: "  # - name:" (indent trimmed to base + # + space + -)
  let firstLinePrefix: string;
  let contentLinePrefix: string;

  if (commented) {
    firstLinePrefix = `${indent}# `;
    contentLinePrefix = `${indent}#   `;
  } else {
    firstLinePrefix = indent;
    contentLinePrefix = `${indent}  `;
  }

  const lines = [
    `${firstLinePrefix}- name: "${entry.name}"`,
    `${contentLinePrefix}description: "${entry.description || ''}"`,
    `${contentLinePrefix}path: ${entry.path}`
  ];

  // Add label if present
  if (entry.label) {
    lines.push(`${contentLinePrefix}label: "${entry.label}"`);
  }

  // Add color if present
  if (entry.color) {
    lines.push(`${contentLinePrefix}color: "${entry.color}"`);
  }

  lines.push(`${contentLinePrefix}pattern: "${entry.pattern}"`);

  // Add prefixPattern if present
  if (entry.prefixPattern) {
    lines.push(`${contentLinePrefix}prefixPattern: "${entry.prefixPattern}"`);
  }

  if (entry.argumentHint) {
    lines.push(`${contentLinePrefix}argumentHint: "${entry.argumentHint}"`);
  }
  if (entry.maxSuggestions !== undefined) {
    lines.push(`${contentLinePrefix}maxSuggestions: ${entry.maxSuggestions}`);
  }

  return lines.join('\n');
}

/**
 * Format a customSearch entry as YAML
 */
function formatCustomSearchEntry(entry: MentionEntry, indent: string, commented = false): string {
  // When commented, use "    # " prefix to match the customSearch indentation level
  // Active:    "    - name:" (4 spaces + -)
  // Commented: "    # - name:" (4 spaces + # + space + -)
  let firstLinePrefix: string;
  let contentLinePrefix: string;

  if (commented) {
    firstLinePrefix = '    # ';
    contentLinePrefix = '    #   ';
  } else {
    firstLinePrefix = indent;
    contentLinePrefix = `${indent}  `;
  }

  const lines = [
    `${firstLinePrefix}- name: "${entry.name}"`,
    `${contentLinePrefix}description: "${entry.description}"`,
    `${contentLinePrefix}path: ${entry.path}`,
    `${contentLinePrefix}pattern: "${entry.pattern}"`
  ];

  // Add prefixPattern if present
  if (entry.prefixPattern) {
    lines.push(`${contentLinePrefix}prefixPattern: "${entry.prefixPattern}"`);
  }

  if (entry.searchPrefix) {
    lines.push(`${contentLinePrefix}searchPrefix: ${entry.searchPrefix}            # Search with @${entry.searchPrefix}:`);
  }
  if (entry.maxSuggestions !== undefined) {
    lines.push(`${contentLinePrefix}maxSuggestions: ${entry.maxSuggestions}`);
  }
  if (entry.sortOrder !== undefined) {
    lines.push(`${contentLinePrefix}sortOrder: ${entry.sortOrder}`);
  }
  if (entry.inputFormat !== undefined) {
    lines.push(`${contentLinePrefix}inputFormat: ${entry.inputFormat}               # Insert file path instead of name`);
  }

  return lines.join('\n');
}

/**
 * Build extensions section
 */
function buildExtensionsSection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const extensions = settings.fileOpener?.extensions || {};
  const hasExtensions = Object.keys(extensions).length > 0;

  if (!hasExtensions) {
    return `#extensions:                       # Extension-specific apps (uncomment to enable)
  #  ts: "WebStorm"
  #  md: "Typora"
  #  pdf: "Preview"`;
  }

  let section = `extensions:${formatExtensionsAsList(extensions)}`;

  // Add commented examples if requested
  if (options.includeCommentedExamples) {
    const commented = commentedExamples.fileOpener?.extensions || {};
    for (const [ext, app] of Object.entries(commented)) {
      section += `\n    # ${ext}: "${app}"`;
    }
  }

  return section;
}

/**
 * Build builtInCommands section
 */
function buildBuiltInCommandsSection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const builtInCommands = settings.builtInCommands;
  const hasBuiltInCommands = builtInCommands && builtInCommands.length > 0;

  if (!hasBuiltInCommands) {
    return `#builtInCommands:                      # List of tools to enable
#  - claude
#  - codex
#  - gemini`;
  }

  let section = 'builtInCommands:                      # List of tools to enable\n';
  for (const cmd of builtInCommands) {
    section += `  - ${cmd}\n`;
  }

  // Add commented examples if requested
  if (options.includeCommentedExamples) {
    const commentedCmds = commentedExamples.builtInCommands || [];
    for (const cmd of commentedCmds) {
      section += `  # - ${cmd}\n`;
    }
  }

  return section.trimEnd();
}

/**
 * Build agentSkills section
 */
function buildAgentSkillsSection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const agentSkills = settings.agentSkills;
  const hasAgentSkills = agentSkills && agentSkills.length > 0;

  if (!hasAgentSkills) {
    // No agent skills configured - output commented template
    return `#agentSkills:
#  - name: "{basename}"
#    description: "{frontmatter@description}"
#    path: ~/.claude/commands
#    pattern: "*.md"
#    argumentHint: "{frontmatter@argument-hint}"
#    maxSuggestions: 20`;
  }

  // Build the section with actual values
  let section = '# Agent skills: custom commands from markdown files\n';
  section += '# Configuration fields:\n';
  section += '#   name: Display name template (variables: {basename}, {frontmatter@field}, {prefix})\n';
  section += '#   description: Skill description template (variables: {basename}, {frontmatter@field}, {dirname}, {dirname:N})\n';
  section += '#   path: Directory path to search for skill files\n';
  section += '#   label: Display label for UI badge (e.g., "command", "skill", "agent")\n';
  section += '#   color: Badge color (name: grey, darkGrey, blue, purple, teal, green, yellow, orange, pink, red, or hex: #FF5733)\n';
  section += '#   pattern: Glob pattern to match files (e.g., "*.md", "**/*/SKILL.md")\n';
  section += '#   prefixPattern: Pattern to extract prefix from plugin metadata\n';
  section += '#   argumentHint: Hint for skill arguments\n';
  section += '#   maxSuggestions: Maximum number of suggestions to display\n';
  section += '#   {dirname}: Parent directory name\n';
  section += '#   {dirname:N}: N levels up directory name (e.g., {dirname:2} = grandparent)\n';
  section += 'agentSkills:\n';

  for (const entry of agentSkills) {
    section += formatAgentSkillEntry(entry, '  ') + '\n';
  }

  // Add commented examples if requested
  if (options.includeCommentedExamples) {
    const commentedEntries = commentedExamples.agentSkills || [];
    for (const entry of commentedEntries) {
      section += formatAgentSkillEntry(entry, '  ', true) + '\n';
    }
  }

  return section.trimEnd();
}

/**
 * Build mentions section
 */
function buildMentionsSection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const fileSearch = settings.mentions?.fileSearch || settings.fileSearch;
  const symbolSearch = settings.mentions?.symbolSearch || settings.symbolSearch;
  const customSearchEntries = settings.mentions?.customSearch ?? settings.mentions?.mdSearch;

  const hasAnyMentionSettings = fileSearch || symbolSearch || (customSearchEntries && customSearchEntries.length > 0);

  if (!hasAnyMentionSettings) {
    // No mentions configured - output commented template
    return `#mentions:
#  # File search settings (@path/to/file completion)
#  # Note: fd command required (brew install fd)
#  fileSearch:
#    respectGitignore: true           # Respect .gitignore files
#    includeHidden: true              # Include hidden files
#    maxFiles: 5000                   # Maximum files to return
#    maxDepth: null                   # Directory depth (null = unlimited)
#    maxSuggestions: 50               # Suggestions to show
#    followSymlinks: false            # Follow symbolic links
#    #fdPath: null                    # Custom path to fd
#
#  # Symbol search settings (@ts:Config, @go:Handler)
#  # Note: ripgrep required (brew install ripgrep)
#  symbolSearch:
#    maxSymbols: 200000               # Maximum symbols to return
#    timeout: 60000                   # Search timeout in ms
#    #rgPath: null                    # Custom path to rg
#
#  # Markdown-based mentions from markdown files
#  # Pattern examples:
#  #   "*.md"                  - Root directory only
#  #   "**/*.md"               - All subdirectories (recursive)
#  #   "**/commands/*.md"      - Any "commands" subdirectory
#  #   "**/*/SKILL.md"         - SKILL.md in any subdirectory
#  #   "**/{cmd,agent}/*.md"   - Brace expansion (cmd or agent dirs)
#  #   "test-*.md"             - Wildcard prefix
#  # searchPrefix: Search with @<prefix>: (e.g., searchPrefix: "agent" → @agent:)
#  customSearch:
#    - name: "agent-{basename}"
#      description: "{frontmatter@description}"
#      path: ~/.claude/agents
#      pattern: "*.md"
#      searchPrefix: agent            # Search with @agent:`;
  }

  let section = 'mentions:\n';

  // File search subsection
  if (fileSearch) {
    const fs = fileSearch as FileSearchUserSettings;
    const fdPathSection = fs.fdPath
      ? `fdPath: "${fs.fdPath}"`
      : `#fdPath: null                    # Custom path to fd`;

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
    respectGitignore: ${formatValue(fs.respectGitignore)}           # Respect .gitignore files
    includeHidden: ${formatValue(fs.includeHidden)}              # Include hidden files
    maxFiles: ${formatValue(fs.maxFiles)}                   # Maximum files to return
    maxDepth: ${formatValue(fs.maxDepth)}                   # Directory depth (null = unlimited)
    maxSuggestions: ${formatValue(fs.maxSuggestions)}               # Suggestions to show
    followSymlinks: ${formatValue(fs.followSymlinks)}            # Follow symbolic links
    ${fdPathSection}
    # Include patterns: Force include files even if in .gitignore (default: [])
    # Example: includePatterns: ["*.log", "dist/**"]
    includePatterns: ${formatValue(fs.includePatterns)}
    # Exclude patterns: Additional patterns to exclude (default: [])
    # Example: excludePatterns: ["node_modules", "*.min.js", "coverage/**"]
    excludePatterns: ${formatValue(fs.excludePatterns)}
`;
  } else {
    section += `  # File search settings (@path/to/file completion)
  # Note: Uncomment fileSearch section to enable file search
  #fileSearch:
  #  respectGitignore: true
  #  includeHidden: true
  #  maxFiles: 5000
  #  maxDepth: null
  #  maxSuggestions: 50
`;
  }

  // Symbol search subsection
  if (symbolSearch) {
    const ss = symbolSearch as SymbolSearchUserSettings;
    const rgPathSection = ss.rgPath
      ? `rgPath: "${ss.rgPath}"`
      : `#rgPath: null                    # Custom path to rg`;

    section += `
  # Symbol search settings (@ts:Config, @go:Handler)
  # Note: ripgrep required (brew install ripgrep)
  symbolSearch:
    maxSymbols: ${formatValue(ss.maxSymbols)}                # Maximum symbols to return
    timeout: ${formatValue(ss.timeout)}                    # Search timeout in ms
    ${rgPathSection}
    # Include patterns: Force include files even if excluded by default (default: [])
    # Example: includePatterns: ["*.test.ts", "vendor/**"]
    includePatterns: ${formatValue(ss.includePatterns ?? [])}
    # Exclude patterns: Additional patterns to exclude (default: [])
    # Example: excludePatterns: ["*.generated.go", "node_modules/**"]
    excludePatterns: ${formatValue(ss.excludePatterns ?? [])}
`;
  } else {
    section += `
  # Symbol search settings (@ts:Config, @go:Handler)
  symbolSearch:
    maxSymbols: 200000
    timeout: 60000
    #rgPath: null
`;
  }

  // Markdown-based mentions subsection
  section += `
  # Markdown-based mentions from markdown files
  # Configuration fields:
  #   name: Display name template (variables: {basename}, {frontmatter@field}, {prefix})
  #   description: Entry description template (variables: {basename}, {frontmatter@field}, {dirname}, {dirname:N})
  #   path: Directory path to search for markdown files
  #   pattern: Glob pattern to match files
  #   prefixPattern: Pattern to extract prefix from plugin metadata
  #   searchPrefix: Prefix to trigger this search (e.g., "agent" → @agent:)
  #   maxSuggestions: Maximum number of suggestions to display
  #   sortOrder: Sort order (asc, desc)
  #   inputFormat: Insert format (name, path)
  #   {dirname}: Parent directory name
  #   {dirname:N}: N levels up directory name (e.g., {dirname:2} = grandparent)
  #
  # Pattern examples:
  #   "*.md"                  - Root directory only
  #   "**/*.md"               - All subdirectories (recursive)
  #   "**/commands/*.md"      - Any "commands" subdirectory
  #   "**/*/SKILL.md"         - SKILL.md in any subdirectory
  #   "**/{cmd,agent}/*.md"   - Brace expansion (cmd or agent dirs)
  #   "test-*.md"             - Wildcard prefix
  customSearch:
`;

  if (customSearchEntries && customSearchEntries.length > 0) {
    for (const entry of customSearchEntries) {
      section += formatCustomSearchEntry(entry, '    ') + '\n\n';
    }
  }

  // Add commented customSearch examples if requested
  if (options.includeCommentedExamples) {
    const commentedCustomSearch = commentedExamples.mentions?.customSearch ?? [];
    for (const entry of commentedCustomSearch) {
      section += formatCustomSearchEntry(entry as MentionEntry, '    ', true) + '\n\n';
    }
  }

  return section.trimEnd();
}

/**
 * Generate YAML settings content
 *
 * @param settings The settings to generate YAML for
 * @param options Generation options
 * @returns YAML string with comments
 */
export function generateSettingsYaml(settings: UserSettings, options: YamlGeneratorOptions = {}): string {
  const extensionsSection = buildExtensionsSection(settings, options);
  const builtInCommandsSection = buildBuiltInCommandsSection(settings, options);
  const agentSkillsSection = buildAgentSkillsSection(settings, options);
  const mentionsSection = buildMentionsSection(settings, options);

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
# BUILT-IN COMMANDS
# ============================================================================
# Built-in commands (Claude, Codex, Gemini, etc.)

${builtInCommandsSection}

# ============================================================================
# AGENT SKILLS SETTINGS
# ============================================================================
# Configure agent skills: custom commands from markdown files
# Template variables: {basename}, {frontmatter@fieldName}

${agentSkillsSection}

# ============================================================================
# MENTION SETTINGS (@ mentions)
# ============================================================================
# Configure @ mention sources: fileSearch, symbolSearch, customSearch
# Template variables for customSearch: {basename}, {frontmatter@fieldName}

${mentionsSection}
`;
}
