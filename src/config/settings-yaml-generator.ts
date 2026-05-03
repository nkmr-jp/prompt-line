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
  PluginFormat,
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
   * Used for settings.example.yaml generation
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
    `${content}sourcePath: ${entry.sourcePath}`
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
  lines.push(`${p}sourcePath: ${entry.sourcePath}`);
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
  if (entry.maxSuggestions !== undefined) lines.push(`${p}maxSuggestions: ${entry.maxSuggestions}`);
  if (entry.orderBy !== undefined) lines.push(`${p}orderBy: "${entry.orderBy}"`);
  if (entry.displayTime !== undefined) lines.push(`${p}displayTime: "${entry.displayTime}"`);
  if (entry.inputFormat !== undefined) lines.push(`${p}inputFormat: ${entry.inputFormat}               # Insert format template`);
  if (entry.runCommand) lines.push(`${p}runCommand: "${entry.runCommand}"            # Shell command on Ctrl+Enter`);
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

function isPluginsEmpty(plugins: PluginFormat | undefined): boolean {
  if (!plugins) return true;
  if (Array.isArray(plugins)) return plugins.length === 0;
  return Object.keys(plugins).length === 0;
}

function buildPluginsSection(settings: UserSettings): string {
  const plugins = settings.plugins;

  if (isPluginsEmpty(plugins)) {
    return `#plugins:
#  github.com/nkmr-jp/prompt-line-plugins:
#    - claude/agent-built-in/en                  # Claude Code built-in commands,skills,agents | lang: en,ja
#    - claude/agent-skills/commands              # sourcePath: ~/.claude/commands/*.md
#    - claude/agent-skills/skills                # sourcePath: ~/.claude/skills/**/SKILL.md
#    - claude/custom-search/agents@agent         # sourcePath: ~/.claude/agents/*.md
#    - claude/custom-search/history@r            # sourcePath: ~/.claude/history.jsonl`;
  }

  let section = `plugins:\n`;
  if (Array.isArray(plugins)) {
    for (const plugin of plugins) {
      section += `  - ${plugin}\n`;
    }
  } else {
    for (const [packageId, entries] of Object.entries(plugins as Record<string, string[]>)) {
      section += `  ${packageId}:\n`;
      for (const entry of entries) {
        section += `    - ${entry}\n`;
      }
    }
  }
  return section.trimEnd();
}

/**
 * Build agentBuiltIn section
 */
function buildAgentBuiltInSection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const agentBuiltIn = settings.agentBuiltIn;
  const hasAgentBuiltIn = agentBuiltIn && agentBuiltIn.length > 0;

  if (!hasAgentBuiltIn) {
    return `# Agent built-in slash commands (type "/" to access)
# @deprecated Use plugins setting instead (github.com/nkmr-jp/prompt-line-plugins/<tool>/agent-built-in/*)
#agentBuiltIn:
#  - claude`;
  }

  let section = `# Agent built-in slash commands (type "/" to access)
# @deprecated Use plugins setting instead (github.com/nkmr-jp/prompt-line-plugins/<tool>/agent-built-in/*)
agentBuiltIn:\n`;
  for (const cmd of agentBuiltIn) {
    section += `  - ${cmd}\n`;
  }

  // Add commented examples if requested
  if (options.includeCommentedExamples) {
    const commentedCmds = commentedExamples.agentBuiltIn || [];
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
    '#   sourcePath: Source path with glob (e.g., "~/.claude/commands/*.md")',
    '#   label: Display label for UI badge (e.g., "command", "skill", "agent")',
    '#   color: Badge color (name: grey, darkGrey, slate, stone, red, rose, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, or hex: #FF5733)',
    '#   icon: Codicon icon name (e.g., "agent", "rocket", "terminal")',
    '#   values: Map of template variable names to JSON extraction patterns (e.g., pluginName: "**/.claude-plugin/*.json@name")',
    '#   argumentHint: Hint for skill arguments',
    '#   maxSuggestions: Maximum number of suggestions to display',
    '#   triggers: Trigger character array (default: ["/"]). e.g., ["/", "$"] enables both / and $ activation',
    '#   {dirname}: Parent directory name',
    '#   {dirname:N}: N levels up directory name (e.g., {dirname:2} = grandparent)',
    '#   {pathdir:N}: N-th directory from path downward (e.g., path/a/b/file.md → {pathdir:1} = a)',
    '#   {projectdir}: Current project directory (detected CWD from active window)',
    '#   {latest}: In pattern, matches only the most recently modified directory at that position',
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
#    sourcePath: ~/.claude/commands/*.md
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
#   sourcePath      : Source path with glob pattern (e.g., "~/.claude/commands/*.md")
#   values          : Map of template variable names to JSON extraction patterns (e.g., pluginName: "**/.claude-plugin/*.json@name")
#   searchPrefix    : Prefix to trigger this search (e.g., "agent" → @agent:)
#   maxSuggestions  : Maximum number of suggestions to display
#   orderBy         : Sort order (e.g., "name", "name desc", "{mtime} desc")
#   displayTime     : Timestamp to display (e.g., "{mtime}", "{json@createdAt}", "none" to hide)
#   inputFormat     : Insert format ('name' = display name, or template e.g. '{filepath}', '{content}')
#   color           : Badge color (name or hex)
#   icon            : Codicon icon name (e.g., "agent", "rocket", "terminal")
#                     https://microsoft.github.io/vscode-codicons/dist/codicon.html
#   label           : UI badge label
#   sourceCommand   : Shell command for data source (e.g., "ghq list") — used instead of sourcePath
#   runCommand      : Shell command on Ctrl+Enter (e.g., "open -a iTerm ~/ghq/{line}")
#   args            : Template arguments (e.g., { open: "iTerm" } → {args.open})
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
#   {pathdir:N}         — N-th directory from path downward (e.g., path/a/b/file.md → {pathdir:1} = a)
#   {projectdir}        — Current project directory (detected CWD from active window)
#   {latest}            — In pattern, matches only the most recently modified directory at that position
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
#    sourcePath: ~/.claude/agents/*.md
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

  return `fileSearch:
  respectGitignore: ${formatValue(fs.respectGitignore)}
  includeHidden: ${formatValue(fs.includeHidden)}
  maxFiles: ${formatValue(fs.maxFiles)}
  maxDepth: ${formatValue(fs.maxDepth)}
  maxSuggestions: ${formatValue(fs.maxSuggestions)}
  followSymlinks: ${formatValue(fs.followSymlinks)}
  ${fdPathSection}
  includePatterns: ${formatValue(fs.includePatterns)}
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

  return `symbolSearch:
  respectGitignore: ${formatValue(ss.respectGitignore)}
  maxSymbols: ${formatValue(ss.maxSymbols)}
  timeout: ${formatValue(ss.timeout)}
  followSymlinks: ${formatValue(ss.followSymlinks)}
  ${rgPathSection}
  includePatterns: ${formatValue(ss.includePatterns ?? [])}
  excludePatterns: ${formatValue(ss.excludePatterns ?? [])}`;
}

/**
 * Build the top sections of the settings YAML (shortcuts, window, fileOpener)
 */

const IMAGE_DIR_COMMENT = `# Image storage directory (default: ~/.prompt-line/images/)`;

function buildImageDirectorySection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const imagesDirectory = settings.imagesDirectory;

  if (imagesDirectory) {
    return `${IMAGE_DIR_COMMENT}
imagesDirectory: ${imagesDirectory}`;
  }

  const example = options.includeCommentedExamples && commentedExamples.imagesDirectory
    ? commentedExamples.imagesDirectory
    : '.prompt-line/images';

  return `${IMAGE_DIR_COMMENT}
#imagesDirectory: ${example}`;
}

function buildShortcutsSection(settings: UserSettings): string {
  const s = settings.shortcuts;
  const col = 36;
  const pad = (str: string) => str.padEnd(col);
  const lines = [
    `shortcuts:`,
    `${pad(`  ${s.main}: main`)}# Show/hide the input window (global)`,
    `${pad(`  ${s.paste}: paste`)}# Paste text and close window`,
    `${pad(`  ${s.close}: close`)}# Close window without pasting`,
    `${pad(`  ${s.historyNext}: historyNext`)}# Navigate to next history item`,
    `${pad(`  ${s.historyPrev}: historyPrev`)}# Navigate to previous history item`,
    `${pad(`  ${s.search}: search`)}# Enable search mode in history`,
    `  # Ctrl+m: "input=@md:"  # Custom action (e.g. input text field "input=xxx")`,
    `  # Ctrl+g: "input=@ghq:"`,
    `  # Ctrl+e: "run=code {projectdir}"  # Run shell command (template variable: {projectdir})`,
  ];
  return lines.join('\n');
}

function buildAdditionalPathsSection(settings: UserSettings, options: YamlGeneratorOptions): string {
  const paths = settings.additionalPaths;
  const hasPaths = paths && paths.length > 0;

  if (!hasPaths) {
    if (options.includeCommentedExamples) {
      const examples = commentedExamples.additionalPaths || [];
      if (examples.length > 0) {
        let section = `# Additional PATH entries for shell command execution (e.g., sourceCommand)\n#additionalPaths:`;
        for (const p of examples) {
          section += `\n#  - ${p}`;
        }
        return section;
      }
    }
    return `# Additional PATH entries for shell command execution (e.g., sourceCommand)\n#additionalPaths:\n#  - /opt/local/bin`;
  }

  let section = `# Additional PATH entries for shell command execution (e.g., sourceCommand)\nadditionalPaths:`;
  for (const p of paths) {
    section += `\n  - ${p}`;
  }
  return section;
}

function buildTopSections(settings: UserSettings): string {
  return `# Prompt Line Settings
# See: https://github.com/nkmr-jp/prompt-line/docs/en/settings.md

# Window: active-text-field | active-window-center | cursor | center
window:
  position: ${settings.window.position}
  width: ${settings.window.width}
  height: ${settings.window.height}

# Shortcuts (key → action)
${buildShortcutsSection(settings)}
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
  const imagesDirectorySection = buildImageDirectorySection(settings, options);
  const pluginsSection = buildPluginsSection(settings);
  const fileSearchSection = buildFileSearchSection(settings);
  const symbolSearchSection = buildSymbolSearchSection(settings);
  const additionalPathsSection = buildAdditionalPathsSection(settings, options);
  const extensionsSection = buildExtensionsSection(settings, options);
  const directoriesSection = buildDirectoriesSection(settings);
  const defaultEditor = settings.fileOpener?.defaultEditor === null || settings.fileOpener?.defaultEditor === undefined
    ? 'null'
    : `"${settings.fileOpener.defaultEditor}"`;
  const topSections = buildTopSections(settings);

  // Build deprecated sections only if user has data
  let deprecatedSections = '';
  if (settings.agentBuiltIn && settings.agentBuiltIn.length > 0) {
    deprecatedSections += `
# ============================================================================
# AGENT BUILT-IN (deprecated — use plugins instead)
# ============================================================================

${buildAgentBuiltInSection(settings, options)}
`;
  }
  if (settings.agentSkills && settings.agentSkills.length > 0) {
    deprecatedSections += `
# ============================================================================
# AGENT SKILLS SETTINGS (deprecated — use plugins instead)
# ============================================================================

${buildAgentSkillsSection(settings, options)}
`;
  }
  if (settings.customSearch && settings.customSearch.length > 0) {
    deprecatedSections += `
# ============================================================================
# CUSTOM SEARCH SETTINGS (deprecated — use plugins instead)
# ============================================================================

${buildCustomSearchSection(settings, options)}
`;
  }

  return `${topSections}
# Plugins (refs: \`prompt-line-plugin help\`)
${pluginsSection}

# File opener (priority: extensions > directories > defaultEditor > system default)
fileOpener:
  defaultEditor: ${defaultEditor}
  ${extensionsSection}
  ${directoriesSection}

${imagesDirectorySection}

# File search (@path/to/file) — requires fd (brew install fd)
${fileSearchSection}

# Symbol search (@lang:query) — requires ripgrep (brew install ripgrep)
${symbolSearchSection}

${additionalPathsSection}
${deprecatedSections}`;
}
