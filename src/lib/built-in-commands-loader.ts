import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import config from '../config/app-config';
import { logger, validateColorValue } from '../utils/utils';
import { AgentSkillItem, ColorValue } from '../types/window';

/**
 * Command definition in YAML file
 */
interface CommandDefinition {
  name: string;
  description: string;
  'argument-hint'?: string;
  /**
   * Color for label and highlight
   * Supports both named colors and hex color codes:
   * - Named colors: 'grey', 'slate', 'red', 'rose', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink'
   * - Hex codes: '#RGB' or '#RRGGBB' (e.g., '#FF6B35', '#F63')
   */
  color?: ColorValue;
}

/**
 * YAML file structure for built-in commands
 */
interface BuiltInCommandsYaml {
  name?: string;  // Display name for the tool (e.g., "claude")
  reference?: string;  // Reference URL for documentation
  /**
   * Default color for all commands in this file
   * Supports both named colors and hex color codes:
   * - Named colors: 'grey', 'slate', 'red', 'rose', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink'
   * - Hex codes: '#RGB' or '#RRGGBB' (e.g., '#FF6B35', '#F63')
   */
  color?: ColorValue;
  commands: CommandDefinition[];
}

/**
 * Built-in commands settings (list of tool names to enable)
 * If this is defined and has values, only those tools are enabled.
 * If undefined, all built-in commands are disabled.
 * If empty array, all built-in commands are enabled.
 */
type BuiltInCommandsSettings = string[];

/**
 * Loads and searches built-in slash commands from YAML files
 * Separate from CustomSearchLoader - handles YAML format directly
 */
class BuiltInCommandsLoader {
  private commands: AgentSkillItem[] = [];
  private initialized = false;
  private targetDir: string;

  constructor() {
    this.targetDir = config.paths.builtInCommandsDir;
  }

  /**
   * Extract tool name from YAML filename
   * e.g., "claude.yml" -> "claude"
   */
  private getToolName(filename: string): string {
    return path.basename(filename, path.extname(filename));
  }

  /**
   * Load all commands from YAML files in target directory
   */
  loadCommands(): AgentSkillItem[] {
    if (this.initialized) {
      return this.commands;
    }

    this.commands = [];

    if (!fs.existsSync(this.targetDir)) {
      logger.debug('Built-in commands directory does not exist:', this.targetDir);
      this.initialized = true;
      return this.commands;
    }

    try {
      const files = fs.readdirSync(this.targetDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of yamlFiles) {
        const filePath = path.join(this.targetDir, file);
        const toolName = this.getToolName(file);
        const commands = this.parseYamlFile(filePath, toolName);
        this.commands.push(...commands);
      }

      logger.debug('Built-in commands loaded', {
        directory: this.targetDir,
        fileCount: yamlFiles.length,
        commandCount: this.commands.length
      });
    } catch (error) {
      logger.error('Failed to load built-in commands:', error);
    }

    this.initialized = true;
    return this.commands;
  }

  /**
   * Parse a YAML file and return AgentSkillItem array
   */
  private parseYamlFile(filePath: string, toolName: string): AgentSkillItem[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.load(content) as BuiltInCommandsYaml;

      if (!parsed?.commands || !Array.isArray(parsed.commands)) {
        logger.warn(`Invalid YAML structure in ${filePath}`);
        return [];
      }

      // Use YAML name field if present, otherwise fallback to filename-based toolName
      const displayName = parsed.name || toolName;
      const reference = parsed.reference;
      const defaultColor = parsed.color;

      return parsed.commands
        .filter(cmd => cmd.name && cmd.description)
        .map(cmd => this.toAgentSkillItem(cmd, filePath, toolName, displayName, reference, defaultColor));
    } catch (error) {
      logger.warn(`Failed to parse YAML file: ${filePath}`, error);
      return [];
    }
  }

  /**
   * Convert CommandDefinition to AgentSkillItem
   * @param cmd - Command definition from YAML
   * @param filePath - Path to the YAML file
   * @param toolName - Tool identifier from filename (for filtering)
   * @param displayName - Human-readable name from YAML (for display)
   * @param reference - Reference URL for documentation (optional)
   * @param defaultColor - Default color from YAML file level (optional)
   */
  private toAgentSkillItem(
    cmd: CommandDefinition,
    filePath: string,
    toolName: string,
    displayName: string,
    reference?: string,
    defaultColor?: ColorValue
  ): AgentSkillItem {
    // Determine color: command-level color takes precedence over file-level default color
    const rawColor = cmd.color || defaultColor;
    // Validate color value (supports both named colors and hex codes)
    const color = rawColor ? validateColorValue(rawColor) : undefined;

    // Build frontmatter string for popup display
    const frontmatterLines = [
      `description: ${cmd.description}`,
      `source: ${displayName}`,
    ];
    if (cmd['argument-hint']) {
      frontmatterLines.push(`argument-hint: ${cmd['argument-hint']}`);
    }
    if (color) {
      frontmatterLines.push(`color: ${color}`);
    }
    if (reference) {
      frontmatterLines.push(`reference: ${reference}`);
    }

    const item: AgentSkillItem = {
      name: cmd.name,
      description: cmd.description,
      filePath: filePath,
      frontmatter: frontmatterLines.join('\n'),
      inputFormat: 'name',
      source: toolName,  // Keep toolName for filtering (e.g., 'claude-code')
      displayName: displayName  // Human-readable name for display (e.g., 'Claude Code')
    };

    // Only add argumentHint if it exists
    if (cmd['argument-hint']) {
      item.argumentHint = cmd['argument-hint'];
    }

    // Only add color if it exists
    if (color) {
      item.color = color;
    }

    return item;
  }

  /**
   * Search commands with optional query filter and settings
   * Returns commands whose name starts with the query (case-insensitive)
   * @param query - Search query (optional)
   * @param settings - Built-in commands settings (if undefined, commands are disabled)
   */
  searchCommands(query?: string, settings?: BuiltInCommandsSettings): AgentSkillItem[] {
    // If settings is undefined (builtIn section is commented out), commands are disabled
    if (!settings) {
      return [];
    }

    let commands = this.loadCommands();

    // Filter by enabled tools if specified
    if (settings && settings.length > 0) {
      const enabledTools = new Set(settings);
      commands = commands.filter(cmd => cmd.source && enabledTools.has(cmd.source));
    }

    // Filter by query if specified
    if (query && query.trim() !== '') {
      const lowerQuery = query.toLowerCase();
      commands = commands.filter(cmd =>
        cmd.name.toLowerCase().startsWith(lowerQuery)
      );
    }

    return commands;
  }

  /**
   * Get list of available tools (from loaded YAML files)
   */
  getAvailableTools(): string[] {
    const commands = this.loadCommands();
    const tools = new Set<string>();
    for (const cmd of commands) {
      if (cmd.source) {
        tools.add(cmd.source);
      }
    }
    return Array.from(tools);
  }

  /**
   * Clear the cache to force reload
   */
  clearCache(): void {
    this.commands = [];
    this.initialized = false;
    logger.debug('Built-in commands cache cleared');
  }
}

// Singleton instance
const builtInCommandsLoader = new BuiltInCommandsLoader();

export default builtInCommandsLoader;
export { BuiltInCommandsLoader };
