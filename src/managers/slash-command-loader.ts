import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/utils';
import type { SlashCommandItem } from '../types';

/**
 * SlashCommandLoader loads and parses custom slash command .md files from a directory.
 * Each .md file should have YAML frontmatter with a description field.
 */
class SlashCommandLoader {
  private commandsDirectories: string[] = [];
  private cachedCommands: SlashCommandItem[] = [];
  private lastLoadTime: number = 0;
  private cacheTTL: number = 5000; // 5 seconds cache

  constructor() {
    this.commandsDirectories = [];
  }

  /**
   * Set the directory paths for slash commands
   */
  setDirectories(directories: string[] | undefined): void {
    const newDirs = directories || [];
    const currentDirs = this.commandsDirectories;

    // Check if directories changed
    const changed = newDirs.length !== currentDirs.length ||
      newDirs.some((dir, i) => dir !== currentDirs[i]);

    if (changed) {
      this.commandsDirectories = newDirs;
      this.invalidateCache();
      logger.debug('Slash command directories set', { directories: newDirs });
    }
  }

  /**
   * Get the configured directory paths
   */
  getDirectories(): string[] {
    return [...this.commandsDirectories];
  }

  /**
   * Invalidate the cache to force reload on next getCommands call
   */
  invalidateCache(): void {
    this.cachedCommands = [];
    this.lastLoadTime = 0;
  }

  /**
   * Get all available slash commands, using cache if valid
   */
  async getCommands(): Promise<SlashCommandItem[]> {
    if (this.commandsDirectories.length === 0) {
      return [];
    }

    // Return cached commands if still valid
    if (this.cachedCommands.length > 0 && Date.now() - this.lastLoadTime < this.cacheTTL) {
      return this.cachedCommands;
    }

    try {
      this.cachedCommands = await this.loadCommands();
      this.lastLoadTime = Date.now();
      return this.cachedCommands;
    } catch (error) {
      logger.error('Failed to load slash commands:', error);
      return [];
    }
  }

  /**
   * Load all .md files from all configured directories
   */
  private async loadCommands(): Promise<SlashCommandItem[]> {
    if (this.commandsDirectories.length === 0) {
      return [];
    }

    const allCommands: SlashCommandItem[] = [];
    const seenNames = new Set<string>();

    for (const directory of this.commandsDirectories) {
      const commands = await this.loadCommandsFromDirectory(directory);
      for (const command of commands) {
        // Skip duplicates (first directory takes precedence)
        if (!seenNames.has(command.name)) {
          seenNames.add(command.name);
          allCommands.push(command);
        } else {
          logger.debug('Skipping duplicate command', { name: command.name, directory });
        }
      }
    }

    // Sort commands alphabetically by name
    allCommands.sort((a, b) => a.name.localeCompare(b.name));

    logger.info('Slash commands loaded', { count: allCommands.length, directories: this.commandsDirectories.length });
    return allCommands;
  }

  /**
   * Load all .md files from a single directory
   */
  private async loadCommandsFromDirectory(directory: string): Promise<SlashCommandItem[]> {
    try {
      // Validate directory exists
      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) {
        logger.warn('Commands path is not a directory', { path: directory });
        return [];
      }

      // Read directory contents
      const files = await fs.readdir(directory);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      logger.debug('Found .md files in commands directory', {
        directory,
        count: mdFiles.length
      });

      // Parse each .md file
      const commands: SlashCommandItem[] = [];
      for (const file of mdFiles) {
        const filePath = path.join(directory, file);
        const command = await this.parseCommandFile(filePath, file);
        if (command) {
          commands.push(command);
        }
      }

      return commands;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn('Commands directory does not exist', { path: directory });
        return [];
      }
      throw error;
    }
  }

  /**
   * Parse a single .md file to extract command name, description, and argument-hint
   */
  private async parseCommandFile(filePath: string, fileName: string): Promise<SlashCommandItem | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const { description, argumentHint, rawFrontmatter } = this.extractFrontmatter(content);

      // Command name is the filename without .md extension
      const name = fileName.replace(/\.md$/, '');

      const command: SlashCommandItem = {
        name,
        description: description || '',
        filePath
      };

      // Only set argumentHint if it has a value (exactOptionalPropertyTypes)
      if (argumentHint) {
        command.argumentHint = argumentHint;
      }

      // Only set frontmatter if it has a value (exactOptionalPropertyTypes)
      if (rawFrontmatter) {
        command.frontmatter = rawFrontmatter;
      }

      return command;
    } catch (error) {
      logger.warn('Failed to parse command file', { filePath, error });
      return null;
    }
  }

  /**
   * Extract description, argument-hint, and raw frontmatter from YAML frontmatter
   * Supports format:
   * ---
   * description: Some description here
   * argument-hint: <required argument>
   * ---
   */
  private extractFrontmatter(content: string): { description: string; argumentHint: string; rawFrontmatter: string } {
    // Match YAML frontmatter between --- markers
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch || !frontmatterMatch[1]) {
      return { description: '', argumentHint: '', rawFrontmatter: '' };
    }

    const frontmatter = frontmatterMatch[1];

    // Extract description field (simple parsing without full YAML library)
    let description = '';
    const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descriptionMatch && descriptionMatch[1]) {
      // Remove quotes if present
      description = descriptionMatch[1].trim();
      if ((description.startsWith('"') && description.endsWith('"')) ||
          (description.startsWith("'") && description.endsWith("'"))) {
        description = description.slice(1, -1);
      }
    }

    // Extract argument-hint field
    let argumentHint = '';
    const argumentHintMatch = frontmatter.match(/^argument-hint:\s*(.+)$/m);
    if (argumentHintMatch && argumentHintMatch[1]) {
      // Remove quotes if present
      argumentHint = argumentHintMatch[1].trim();
      if ((argumentHint.startsWith('"') && argumentHint.endsWith('"')) ||
          (argumentHint.startsWith("'") && argumentHint.endsWith("'"))) {
        argumentHint = argumentHint.slice(1, -1);
      }
    }

    return { description, argumentHint, rawFrontmatter: frontmatter.trim() };
  }

  /**
   * Search commands by query (case-insensitive)
   */
  async searchCommands(query: string): Promise<SlashCommandItem[]> {
    const commands = await this.getCommands();

    if (!query) {
      return commands;
    }

    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
    );
  }
}

export default SlashCommandLoader;
