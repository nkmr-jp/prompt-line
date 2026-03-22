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
  AgentSkillEntry,
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
 * Resolve the line prefixes for a YAML entry based on commented flag
 */
function resolveEntryPrefixes(indent: string, commented: boolean): { first: string; content: string } {
  if (commented) {
    return { first: `${indent}# `, content: `${indent}#   ` };
  }
  return { first: indent, content: `${indent}  ` };
}

/**
 * Append optional string fields to a YAML lines array
 */
function appendAgentSkillOptionalFields(lines: string[], entry: AgentSkillEntry, p: string): void {
  if (entry.label) lines.push(`${p}label: "${entry.label}"`);
  if (entry.color) lines.push(`${p}color: "${entry.color}"`);
  if (entry.icon) lines.push(`${p}icon: "${entry.icon}"`);
  lines.push(`${p}pattern: "${entry.pattern}"`);
  if (entry.values) {
    lines.push(`${p}values:`);
    for (const [key, val] of Object.entries(entry.values)) {
      lines.push(`${p}  ${key}: "${val}"`);
    }
  }
  if (entry.prefixPattern && !entry.values) lines.push(`${p}prefixPattern: "${entry.prefixPattern}"`);
  if (entry.argumentHint) lines.push(`${p}argumentHint: "${entry.argumentHint}"`);
  if (entry.maxSuggestions !== undefined) lines.push(`${p}maxSuggestions: ${entry.maxSuggestions}`);
  if (entry.triggers && entry.triggers.length > 0) {
    const triggersStr = entry.triggers.map(t => `"${t}"`).join(', ');
    lines.push(`${p}triggers: [${triggersStr}]`);
  }
}

/**
 * Format an agent skill entry as YAML
 */
function formatAgentSkillEntry(entry: AgentSkillEntry, indent: string, commented = false): string {
  const { first, content } = resolveEntryPrefixes(indent, commented);
  const lines = [
    `${first}- name: "${entry.name}"`,
    `${content}description: "${entry.description || ''}"`,
    `${content}path: ${entry.path}`
  ];
  appendAgentSkillOptionalFields(lines, entry, content);
  return lines.join('\n');
}

/**
 * Append required core fields for a customSearch entry
 */
function appendCustomSearchCoreFields(lines: string[], entry: MentionEntry, p: string): void {
  if (entry.label) lines.push(`${p}label: "${entry.label}"`);
  if (entry.icon) lines.push(`${p}icon: ${entry.icon}`);
  if (entry.color) lines.push(`${p}color: "${entry.color}"`);
  lines.push(`${p}description: "${entry.description}"`);
  lines.push(`${p}path: ${entry.path}`);
  lines.push(`${p}pattern: "${entry.pattern}"`);
}

/**
 * Append optional fields for a customSearch entry
 */
function appendCustomSearchOptionalFields(lines: string[], entry: MentionEntry, p: string): void {
  if (entry.values) {
    lines.push(`${p}values:`);
    for (const [key, val] of Object.entries(entry.values)) {
      lines.push(`${p}  ${key}: "${val}"`);
    }
  }
  if (entry.prefixPattern && !entry.values) lines.push(`${p}prefixPattern: "${entry.prefixPattern}"`);
  if (entry.searchPrefix) lines.push(`${p}searchPrefix: ${entry.searchPrefix}            # Search with @${entry.searchPrefix}:`);
  if (entry.shortcut) lines.push(`${p}shortcut: ${entry.shortcut}              # Keyboard shortcut to activate @${entry.searchPrefix || ''}:`);
  if (entry.maxSuggestions !== undefined) lines.push(`${p}maxSuggestions: ${entry.maxSuggestions}`);
  if (entry.orderBy !== undefined) lines.push(`${p}orderBy: "${entry.orderBy}"`);
  if (entry.displayTime !== undefined) lines.push(`${p}displayTime: "${entry.displayTime}"`);
  if (entry.inputFormat !== undefined) lines.push(`${p}inputFormat: ${entry.inputFormat}               # Insert format template`);
  if (entry.command) lines.push(`${p}command: "${entry.command}"            # Shell command on Ctrl+Enter`);
}

/**
 * Format a customSearch entry as YAML
 */
function formatCustomSearchEntry(entry: MentionEntry, indent: string, commented = false): string {
  const { first, content } = resolveEntryPrefixes(indent, commented);
  const lines = [`${first}- name: "${entry.name}"`];
  appendCustomSearchCoreFields(lines, entry, content);
  appendCustomSearchOptionalFields(lines, entry, content);
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
 * Build directories section
 */
function buildDirectoriesSection(settings: UserSettings): string {
  const directories = settings.fileOpener?.directories || [];
  const hasDirectories = directories.length > 0;

  if (!hasDirectories) {
    return `#directories:                      # Directory-specific editors (supports glob: * and **)
  #  - path: "~/ghq/github.com/my-org/my-go*"
  #    editor: "GoLand"`;
  }

  let section = 'directories:';
  for (const entry of directories) {
    section += `\n    - path: "${entry.path}"`;
    section += `\n      editor: "${entry.editor}"`;
  }

  return section;
}

/**
 * Build plugins section
 */
function buildPluginsSection(settings: UserSettings): string {
  const plugins = settings.plugins;
  const hasPlugins = plugins && plugins.length > 0;

  if (!hasPlugins) {
    return `#plugins:
#  - prompt-line-plugin/claude/agent-skills/commands
#  - prompt-line-plugin/claude/built-in-commands/claude`;
  }

  let section = `plugins:\n`;
  for (const plugin of plugins) {
    section += `  - ${plugin}\n`;
  }

  return section.trimEnd();
}

/**
 * Build builtInCommands section
 */
function buildBuiltInCommandsSection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const builtInCommands = settings.builtInCommands;
  const hasBuiltInCommands = builtInCommands && builtInCommands.length > 0;

  if (!hasBuiltInCommands) {
    return `# Built-in slash commands (type "/" to access)
# @deprecated Use plugins setting instead (prompt-line-plugin/<tool>/built-in-commands/*)
#builtInCommands:
#  - claude`;
  }

  let section = `# Built-in slash commands (type "/" to access)
# @deprecated Use plugins setting instead (prompt-line-plugin/<tool>/built-in-commands/*)
builtInCommands:\n`;
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
 * Build the comment header for the agentSkills section
 */
function buildAgentSkillsHeader(): string {
  return [
    '# Agent skills: custom commands from markdown files',
    '# Search: Space-separated keywords enable AND search (e.g., "/commit fix" matches both words)',
    '# Configuration fields:',
    '#   name: Display name template (variables: {basename}, {frontmatter@field}, {prefix})',
    '#   description: Skill description template (variables: {basename}, {frontmatter@field}, {dirname}, {dirname:N})',
    '#   path: Directory path to search for skill files',
    '#   label: Display label for UI badge (e.g., "command", "skill", "agent")',
    '#   color: Badge color (name: grey, darkGrey, slate, stone, red, rose, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, or hex: #FF5733)',
    '#   icon: Codicon icon name (e.g., "agent", "rocket", "terminal")',
    '#   pattern: Glob pattern to match files (e.g., "*.md", "**/*/SKILL.md")',
    '#   values: Map of template variable names to JSON extraction patterns (e.g., pluginName: "**/.claude-plugin/*.json@name")',
    '#   argumentHint: Hint for skill arguments',
    '#   maxSuggestions: Maximum number of suggestions to display',
    '#   triggers: Trigger character array (default: ["/"]). e.g., ["/", "$"] enables both / and $ activation',
    '#   {dirname}: Parent directory name',
    '#   {dirname:N}: N levels up directory name (e.g., {dirname:2} = grandparent)',
    'agentSkills:'
  ].join('\n') + '\n';
}

/**
 * Build agentSkills section
 */
function buildAgentSkillsSection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const agentSkills = settings.agentSkills;
  const hasAgentSkills = agentSkills && agentSkills.length > 0;

  if (!hasAgentSkills) {
    return `#agentSkills:
#  - name: "{basename}"
#    description: "{frontmatter@description}"
#    path: ~/.claude/commands
#    pattern: "*.md"
#    argumentHint: "{frontmatter@argument-hint}"
#    maxSuggestions: 20`;
  }

  let section = buildAgentSkillsHeader();

  for (const entry of agentSkills) {
    if (typeof entry === 'string') {
      section += `  - ${entry}\n`;
    } else {
      section += formatAgentSkillEntry(entry, '  ') + '\n';
    }
  }

  if (options.includeCommentedExamples) {
    const commentedEntries = commentedExamples.agentSkills || [];
    for (const entry of commentedEntries) {
      section += formatAgentSkillEntry(entry, '  ', true) + '\n';
    }
  }

  return section.trimEnd();
}

/**
 * Build the comment header for the customSearch section
 */
function buildCustomSearchHeader(): string {
  return `# Custom search entries — triggered by typing "@prefix:" (e.g., @agent:, @plan:)
# Scans directories for files matching glob patterns and provides @ mention suggestions.
# Supports: Markdown (.md), JSON (.json), JSONL (.jsonl), jq expressions, and plain text files.
# Search: Space-separated keywords enable AND search (e.g., @agent:dev api)
#
# Configuration fields:
#   name            : Display name template
#   description     : Entry description template (supports "|" fallback: "{json@a}|{json@b}")
#   path            : Directory path to scan (supports ~ for home)
#   pattern         : Glob pattern to match files
#   values          : Map of template variable names to JSON extraction patterns (e.g., pluginName: "**/.claude-plugin/*.json@name")
#   searchPrefix    : Prefix to trigger this search (e.g., "agent" → @agent:)
#   maxSuggestions  : Maximum number of suggestions to display
#   orderBy         : Sort order (e.g., "name", "name desc", "{updatedAt} desc")
#   displayTime     : Timestamp to display (e.g., "{updatedAt}", "{json@createdAt}", "none" to hide)
#   inputFormat     : Insert format ('name' = display name, or template e.g. '{filepath}', '{content}')
#   color           : Badge color (name or hex)
#   icon            : Codicon icon name (e.g., "agent", "rocket", "terminal")
#                     https://microsoft.github.io/vscode-codicons/dist/codicon.html
#   label           : UI badge label
#   shortcut        : Keyboard shortcut to activate this search (e.g., "Ctrl+g")
#                     Inserts @searchPrefix: into the input and triggers mention detection
#
# Template variables:
#   {basename}          — File name without extension
#   {frontmatter@field} — YAML frontmatter field from markdown files
#   {json@field}        — JSON field value (for .json/.jsonl files)
#   {json:N@field}      — JSON field from N-th level array item
#   {prefix}            — Prefix extracted via values (e.g., values: { prefix: "pattern" })
#   {heading}           — First non-empty line of the file (for markdown: first heading)
#   {line}              — Each line of plain text file (generates one item per line)
#   {dirname}           — Parent directory name
#   {dirname:N}         — N levels up directory name (e.g., {dirname:2} = grandparent)
#
# Pattern examples:
#   "*.md"                              — Markdown files in root directory only
#   "**/*.md"                           — All subdirectories (recursive)
#   "**/commands/*.md"                  — Any "commands" subdirectory
#   "**/*/SKILL.md"                     — SKILL.md in any subdirectory
#   "**/{cmd,agent}/*.md"              — Brace expansion (cmd or agent dirs)
#   "*.json"                            — JSON files (use {json@field} for template variables)
#   "**/config.json@.members"          — JSON + jq expression (expands array into items)
#   "*.json@.items | map(select(.active))" — Complex jq expressions supported
#   "*.jsonl"                           — JSONL files (one JSON per line)
#   "*.txt"                             — Plain text files (one item per non-empty line, use {line})
customSearch:
`;
}

/**
 * Build customSearch section
 */
function buildCustomSearchSection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const customSearchEntries = settings.customSearch;
  const hasCustomSearch = customSearchEntries && customSearchEntries.length > 0;

  if (!hasCustomSearch) {
    return `# Custom search entries — triggered by typing "@prefix:" (e.g., @agent:, @plan:)
# Supports: Markdown (.md), JSON (.json), JSONL (.jsonl), jq expressions, and plain text files.
# searchPrefix: Search with @<prefix>: (e.g., searchPrefix: "agent" → @agent:)
#customSearch:
#  - name: "agent-{basename}"
#    description: "{frontmatter@description}"
#    path: ~/.claude/agents
#    pattern: "*.md"
#    searchPrefix: agent            # Search with @agent:`;
  }

  let section = buildCustomSearchHeader();

  for (const entry of customSearchEntries) {
    if (typeof entry === 'string') {
      section += `  - ${entry}\n\n`;
    } else {
      section += formatCustomSearchEntry(entry, '  ') + '\n\n';
    }
  }

  if (options.includeCommentedExamples) {
    const commentedCustomSearch = commentedExamples.customSearch ?? [];
    for (const entry of commentedCustomSearch) {
      const comment = (entry as Record<string, unknown>)._comment as string | undefined;
      if (comment) {
        for (const line of comment.split('\n')) {
          section += `  # ${line}\n`;
        }
      }
      section += formatCustomSearchEntry(entry as MentionEntry, '  ', true) + '\n\n';
    }
  }

  return section.trimEnd();
}

/**
 * Build fileSearch section
 */
function buildFileSearchSection(settings: UserSettings): string {
  const fileSearch = settings.fileSearch;

  if (!fileSearch) {
    return `# File search settings (@path/to/file completion)
# Note: Uncomment fileSearch section to enable file search
#fileSearch:
#  respectGitignore: true
#  includeHidden: true
#  maxFiles: 5000
#  maxDepth: null
#  maxSuggestions: 50`;
  }

  const fs = fileSearch as FileSearchUserSettings;
  const fdPathSection = fs.fdPath
    ? `fdPath: "${fs.fdPath}"`
    : `#fdPath: null                    # Custom path to fd`;

  return `# File search settings (@path/to/file completion)
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
  excludePatterns: ${formatValue(fs.excludePatterns)}`;
}

/**
 * Build symbolSearch section
 */
function buildSymbolSearchSection(settings: UserSettings): string {
  const symbolSearch = settings.symbolSearch;

  if (!symbolSearch) {
    return `# Symbol search settings (@ts:Config, @go:Handler)
#symbolSearch:
#  maxSymbols: 200000
#  timeout: 60000
#  #rgPath: null`;
  }

  const ss = symbolSearch as SymbolSearchUserSettings;
  const rgPathSection = ss.rgPath
    ? `rgPath: "${ss.rgPath}"`
    : `#rgPath: null                    # Custom path to rg`;

  return `# Symbol search settings (@ts:Config, @go:Handler)
# Note: ripgrep required (brew install ripgrep)
# Search: Space-separated keywords enable AND search (e.g., @ts:Config util)
symbolSearch:
  maxSymbols: ${formatValue(ss.maxSymbols)}                # Maximum symbols to return
  timeout: ${formatValue(ss.timeout)}                    # Search timeout in ms
  ${rgPathSection}
  # Include patterns: Force include files even if excluded by default (default: [])
  # Example: includePatterns: ["*.test.ts", "vendor/**"]
  includePatterns: ${formatValue(ss.includePatterns ?? [])}
  # Exclude patterns: Additional patterns to exclude (default: [])
  # Example: excludePatterns: ["*.generated.go", "node_modules/**"]
  excludePatterns: ${formatValue(ss.excludePatterns ?? [])}`;
}

/**
 * Build the top sections of the settings YAML (shortcuts, window, fileOpener)
 */
function buildTopSections(settings: UserSettings, extensionsSection: string, directoriesSection: string): string {
  const defaultEditor = settings.fileOpener?.defaultEditor === null || settings.fileOpener?.defaultEditor === undefined
    ? 'null'
    : `"${settings.fileOpener.defaultEditor}"`;
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
  defaultEditor: ${defaultEditor}
  # Extension-specific applications (overrides defaultEditor and directories)
  ${extensionsSection}
  # Directory-specific default editor (overrides defaultEditor, longest prefix match)
  ${directoriesSection}
`;
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
  const directoriesSection = buildDirectoriesSection(settings);
  const builtInCommandsSection = buildBuiltInCommandsSection(settings, options);
  const agentSkillsSection = buildAgentSkillsSection(settings, options);
  const customSearchSection = buildCustomSearchSection(settings, options);
  const pluginsSection = buildPluginsSection(settings);
  const fileSearchSection = buildFileSearchSection(settings);
  const symbolSearchSection = buildSymbolSearchSection(settings);
  const topSections = buildTopSections(settings, extensionsSection, directoriesSection);

  return `${topSections}
# ============================================================================
# PLUGINS
# ============================================================================
# Plugin entries to enable (paths relative to ~/.prompt-line/plugins/, without .yml extension)
# Comment out entries to disable them.
# Directory determines the plugin type:
#   .../agent-skills/      → Slash commands (type: command, triggered by "/")
#   .../custom-search/     → Mention search (type: mention, triggered by "@prefix:")
#   .../built-in-commands/ → Built-in tool commands (triggered by "/")
# Storage: ~/.prompt-line/plugins/ (YAML files per entry)
# Hot-reload: YAML file changes are auto-detected (no restart needed)

${pluginsSection}

# ============================================================================
# BUILT-IN COMMANDS (deprecated — use plugins instead)
# ============================================================================

${builtInCommandsSection}

# ============================================================================
# AGENT SKILLS SETTINGS
# ============================================================================
# Configure agent skills: custom commands from markdown files
# Template variables: {basename}, {frontmatter@fieldName}

${agentSkillsSection}

# ============================================================================
# CUSTOM SEARCH SETTINGS (@ mentions)
# ============================================================================
# Custom search entries for @ mention sources
# Template variables: {basename}, {frontmatter@fieldName}

${customSearchSection}

# ============================================================================
# FILE SEARCH SETTINGS
# ============================================================================

${fileSearchSection}

# ============================================================================
# SYMBOL SEARCH SETTINGS
# ============================================================================

${symbolSearchSection}
`;
}
