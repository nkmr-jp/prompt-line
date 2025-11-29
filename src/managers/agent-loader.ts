import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/utils';
import type { AgentItem } from '../types';

/**
 * AgentLoader loads and parses agent .md files from configured directories.
 * Each .md file should have YAML frontmatter with a description field.
 */
class AgentLoader {
  private agentDirectories: string[] = [];
  private cachedAgents: AgentItem[] = [];
  private lastLoadTime: number = 0;
  private cacheTTL: number = 5000; // 5 seconds cache

  constructor() {
    this.agentDirectories = [];
  }

  /**
   * Set the directory paths for agents
   */
  setDirectories(directories: string[] | undefined): void {
    const newDirs = directories || [];
    const currentDirs = this.agentDirectories;

    // Check if directories changed
    const changed = newDirs.length !== currentDirs.length ||
      newDirs.some((dir, i) => dir !== currentDirs[i]);

    if (changed) {
      this.agentDirectories = newDirs;
      this.invalidateCache();
      logger.debug('Agent directories set', { directories: newDirs });
    }
  }

  /**
   * Get the configured directory paths
   */
  getDirectories(): string[] {
    return [...this.agentDirectories];
  }

  /**
   * Invalidate the cache to force reload on next getAgents call
   */
  invalidateCache(): void {
    this.cachedAgents = [];
    this.lastLoadTime = 0;
  }

  /**
   * Get all available agents, using cache if valid
   */
  async getAgents(): Promise<AgentItem[]> {
    if (this.agentDirectories.length === 0) {
      return [];
    }

    // Return cached agents if still valid
    if (this.cachedAgents.length > 0 && Date.now() - this.lastLoadTime < this.cacheTTL) {
      return this.cachedAgents;
    }

    try {
      this.cachedAgents = await this.loadAgents();
      this.lastLoadTime = Date.now();
      return this.cachedAgents;
    } catch (error) {
      logger.error('Failed to load agents:', error);
      return [];
    }
  }

  /**
   * Load all .md files from all configured directories
   */
  private async loadAgents(): Promise<AgentItem[]> {
    if (this.agentDirectories.length === 0) {
      return [];
    }

    const allAgents: AgentItem[] = [];
    const seenNames = new Set<string>();

    for (const directory of this.agentDirectories) {
      const agents = await this.loadAgentsFromDirectory(directory);
      for (const agent of agents) {
        // Skip duplicates (first directory takes precedence)
        if (!seenNames.has(agent.name)) {
          seenNames.add(agent.name);
          allAgents.push(agent);
        } else {
          logger.debug('Skipping duplicate agent', { name: agent.name, directory });
        }
      }
    }

    // Sort agents alphabetically by name
    allAgents.sort((a, b) => a.name.localeCompare(b.name));

    logger.info('Agents loaded', { count: allAgents.length, directories: this.agentDirectories.length });
    return allAgents;
  }

  /**
   * Load all .md files from a single directory
   */
  private async loadAgentsFromDirectory(directory: string): Promise<AgentItem[]> {
    try {
      // Validate directory exists
      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) {
        logger.warn('Agents path is not a directory', { path: directory });
        return [];
      }

      // Read directory contents
      const files = await fs.readdir(directory);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      logger.debug('Found .md files in agents directory', {
        directory,
        count: mdFiles.length
      });

      // Parse each .md file
      const agents: AgentItem[] = [];
      for (const file of mdFiles) {
        const filePath = path.join(directory, file);
        const agent = await this.parseAgentFile(filePath, file);
        if (agent) {
          agents.push(agent);
        }
      }

      return agents;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn('Agents directory does not exist', { path: directory });
        return [];
      }
      throw error;
    }
  }

  /**
   * Parse a single .md file to extract agent name and description
   */
  private async parseAgentFile(filePath: string, fileName: string): Promise<AgentItem | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const description = this.extractDescription(content);

      // Agent name is the filename without .md extension
      const name = fileName.replace(/\.md$/, '');

      return {
        name,
        description: description || '',
        filePath
      };
    } catch (error) {
      logger.warn('Failed to parse agent file', { filePath, error });
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
    if (!descriptionMatch || !descriptionMatch[1]) {
      return '';
    }

    // Remove quotes if present
    let description = descriptionMatch[1].trim();
    if ((description.startsWith('"') && description.endsWith('"')) ||
        (description.startsWith("'") && description.endsWith("'"))) {
      description = description.slice(1, -1);
    }

    return description;
  }

  /**
   * Search agents by query (case-insensitive)
   */
  async searchAgents(query: string): Promise<AgentItem[]> {
    const agents = await this.getAgents();

    if (!query) {
      return agents;
    }

    const lowerQuery = query.toLowerCase();
    return agents.filter(agent =>
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.description.toLowerCase().includes(lowerQuery)
    );
  }
}

export default AgentLoader;
