import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/utils';
import type { SlashCommandItem } from '../types';

/**
 * SlashCommandLoader loads and parses custom slash command .md files from a directory.
 * Each .md file should have YAML frontmatter with a description field.
 */
class SlashCommandLoader {
  private commandsDirectory: string | undefined;
  private cachedCommands: SlashCommandItem[] = [];
  private lastLoadTime: number = 0;
  private cacheTTL: number = 5000; // 5 seconds cache

  constructor() {
    this.commandsDirectory = undefined;
  }

  /**
   * Set the directory path for slash commands
   */
  setDirectory(directory: string | undefined): void {
    if (this.commandsDirectory !== directory) {
      this.commandsDirectory = directory;
      this.invalidateCache();
      logger.debug('Slash command directory set', { directory });
    }
  }

  /**
   * Get the configured directory path
   */
  getDirectory(): string | undefined {
    return this.commandsDirectory;
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
    if (!this.commandsDirectory) {
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
   * Load all .md files from the commands directory
   */
  private async loadCommands(): Promise<SlashCommandItem[]> {
    if (!this.commandsDirectory) {
      return [];
    }

    try {
      // Validate directory exists
      const stats = await fs.stat(this.commandsDirectory);
      if (!stats.isDirectory()) {
        logger.warn('Commands path is not a directory', { path: this.commandsDirectory });
        return [];
      }

      // Read directory contents
      const files = await fs.readdir(this.commandsDirectory);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      logger.debug('Found .md files in commands directory', {
        directory: this.commandsDirectory,
        count: mdFiles.length
      });

      // Parse each .md file
      const commands: SlashCommandItem[] = [];
      for (const file of mdFiles) {
        const filePath = path.join(this.commandsDirectory, file);
        const command = await this.parseCommandFile(filePath, file);
        if (command) {
          commands.push(command);
        }
      }

      // Sort commands alphabetically by name
      commands.sort((a, b) => a.name.localeCompare(b.name));

      logger.info('Slash commands loaded', { count: commands.length });
      return commands;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn('Commands directory does not exist', { path: this.commandsDirectory });
        return [];
      }
      throw error;
    }
  }

  /**
   * Parse a single .md file to extract command name and description
   */
  private async parseCommandFile(filePath: string, fileName: string): Promise<SlashCommandItem | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const description = this.extractDescription(content);

      // Command name is the filename without .md extension
      const name = fileName.replace(/\.md$/, '');

      return {
        name,
        description: description || '',
        filePath
      };
    } catch (error) {
      logger.warn('Failed to parse command file', { filePath, error });
      return null;
    }
  }

  /**
   * Extract description from YAML frontmatter
   * Supports format:
   * ---
   * description: Some description here
   * ---
   */
  private extractDescription(content: string): string {
    // Match YAML frontmatter between --- markers
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch || !frontmatterMatch[1]) {
      return '';
    }

    const frontmatter = frontmatterMatch[1];

    // Extract description field (simple parsing without full YAML library)
    const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descriptionMatch && descriptionMatch[1]) {
      // Remove quotes if present
      let description = descriptionMatch[1].trim();
      if ((description.startsWith('"') && description.endsWith('"')) ||
          (description.startsWith("'") && description.endsWith("'"))) {
        description = description.slice(1, -1);
      }
      return description;
    }

    return '';
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
