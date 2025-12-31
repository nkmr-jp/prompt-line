import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import config from '../config/app-config';
import { logger } from '../utils/utils';
import { SlashCommandItem } from '../types/window';

/**
 * Command definition in YAML file
 */
interface CommandDefinition {
  name: string;
  description: string;
  'argument-hint'?: string;
}

/**
 * YAML file structure for built-in commands
 */
interface BuiltInCommandsYaml {
  commands: CommandDefinition[];
}

/**
 * Built-in commands settings
 */
interface BuiltInCommandsSettings {
  enabled?: boolean;
  tools?: string[];
}

/**
 * Loads and searches built-in slash commands from YAML files
 * Separate from MdSearchLoader - handles YAML format directly
 */
class BuiltInCommandsLoader {
  private commands: SlashCommandItem[] = [];
  private initialized = false;
  private targetDir: string;

  constructor() {
    this.targetDir = config.paths.builtInCommandsDir;
  }

  /**
   * Extract tool name from YAML filename
   * e.g., "claude-code.yaml" -> "claude-code"
   */
  private getToolName(filename: string): string {
    return path.basename(filename, path.extname(filename));
  }

  /**
   * Load all commands from YAML files in target directory
   */
  loadCommands(): SlashCommandItem[] {
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
   * Parse a YAML file and return SlashCommandItem array
   */
  private parseYamlFile(filePath: string, toolName: string): SlashCommandItem[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.load(content) as BuiltInCommandsYaml;

      if (!parsed?.commands || !Array.isArray(parsed.commands)) {
        logger.warn(`Invalid YAML structure in ${filePath}`);
        return [];
      }

      return parsed.commands
        .filter(cmd => cmd.name && cmd.description)
        .map(cmd => this.toSlashCommandItem(cmd, filePath, toolName));
    } catch (error) {
      logger.warn(`Failed to parse YAML file: ${filePath}`, error);
      return [];
    }
  }

  /**
   * Convert CommandDefinition to SlashCommandItem
   */
  private toSlashCommandItem(cmd: CommandDefinition, filePath: string, toolName: string): SlashCommandItem {
    // Build frontmatter string for popup display
    const frontmatterLines = [
      `description: ${cmd.description}`,
      `source: ${toolName}`,
    ];
    if (cmd['argument-hint']) {
      frontmatterLines.push(`argument-hint: ${cmd['argument-hint']}`);
    }

    const item: SlashCommandItem = {
      name: cmd.name,
      description: cmd.description,
      filePath: filePath,
      frontmatter: frontmatterLines.join('\n'),
      inputFormat: 'name',
      source: toolName
    };

    // Only add argumentHint if it exists
    if (cmd['argument-hint']) {
      item.argumentHint = cmd['argument-hint'];
    }

    return item;
  }

  /**
   * Search commands with optional query filter and settings
   * Returns commands whose name starts with the query (case-insensitive)
   * @param query - Search query (optional)
   * @param settings - Built-in commands settings (optional)
   */
  searchCommands(query?: string, settings?: BuiltInCommandsSettings): SlashCommandItem[] {
    // Check if built-in commands are enabled
    if (settings && !settings.enabled) {
      return [];
    }

    let commands = this.loadCommands();

    // Filter by enabled tools if specified
    if (settings?.tools && settings.tools.length > 0) {
      const enabledTools = new Set(settings.tools);
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
