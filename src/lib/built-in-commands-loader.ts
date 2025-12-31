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
        const commands = this.parseYamlFile(filePath);
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
  private parseYamlFile(filePath: string): SlashCommandItem[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.load(content) as BuiltInCommandsYaml;

      if (!parsed?.commands || !Array.isArray(parsed.commands)) {
        logger.warn(`Invalid YAML structure in ${filePath}`);
        return [];
      }

      return parsed.commands
        .filter(cmd => cmd.name && cmd.description)
        .map(cmd => this.toSlashCommandItem(cmd, filePath));
    } catch (error) {
      logger.warn(`Failed to parse YAML file: ${filePath}`, error);
      return [];
    }
  }

  /**
   * Convert CommandDefinition to SlashCommandItem
   */
  private toSlashCommandItem(cmd: CommandDefinition, filePath: string): SlashCommandItem {
    // Build frontmatter string for popup display
    const frontmatterLines = [
      `description: ${cmd.description}`,
    ];
    if (cmd['argument-hint']) {
      frontmatterLines.push(`argument-hint: ${cmd['argument-hint']}`);
    }

    const item: SlashCommandItem = {
      name: cmd.name,
      description: cmd.description,
      filePath: filePath,
      frontmatter: frontmatterLines.join('\n'),
      inputFormat: 'name'
    };

    // Only add argumentHint if it exists
    if (cmd['argument-hint']) {
      item.argumentHint = cmd['argument-hint'];
    }

    return item;
  }

  /**
   * Search commands with optional query filter
   * Returns commands whose name starts with the query (case-insensitive)
   */
  searchCommands(query?: string): SlashCommandItem[] {
    const commands = this.loadCommands();

    if (!query || query.trim() === '') {
      return commands;
    }

    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.name.toLowerCase().startsWith(lowerQuery)
    );
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
