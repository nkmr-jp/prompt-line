import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import config from '../config/app-config';
import { logger, validateColorValue } from '../utils/utils';
import type { AgentSkillItem, CustomSearchEntry, ColorValue } from '../types/window';

/**
 * Plugin type determined by directory name
 */
type PluginType = 'agent-skills' | 'custom-search' | 'built-in-commands';

/**
 * YAML structure for agent-skills and custom-search plugins
 */
interface PluginEntryYaml {
  name: string;
  description: string;
  path: string;
  pattern: string;
  label?: string;
  color?: ColorValue;
  icon?: string;
  argumentHint?: string;
  maxSuggestions?: number;
  orderBy?: string;
  values?: Record<string, string>;
  prefixPattern?: string;
  triggers?: string[];
  // custom-search specific
  searchPrefix?: string;
  displayTime?: string;
  inputFormat?: string;
  shortcut?: string;
  command?: string;
}

/**
 * YAML structure for built-in commands plugins
 */
interface BuiltInCommandsYaml {
  name?: string;
  reference?: string;
  color?: ColorValue;
  commands: Array<{
    name: string;
    description: string;
    'argument-hint'?: string;
    color?: ColorValue;
  }>;
}

/**
 * Loaded plugin data
 */
interface LoadedPlugin {
  pluginPath: string;  // relative path (e.g., "prompt-line-plugins/agent-skills/claude-commands")
  type: PluginType;
  entries: CustomSearchEntry[];
  builtInCommands: AgentSkillItem[];
}

/**
 * Unified plugin loader for all plugin types.
 * Reads YAML files from ~/.prompt-line/plugins/ and converts them to
 * CustomSearchEntry[] (for agent-skills/custom-search) or AgentSkillItem[] (for built-in-commands).
 */
class PluginLoader {
  private cache: Map<string, LoadedPlugin> = new Map();
  private pluginsDir: string;

  constructor() {
    this.pluginsDir = config.paths.pluginsDir;
  }

  /**
   * Determine plugin type from the relative path
   * e.g., "prompt-line-plugins/agent-skills/claude-commands" → 'agent-skills'
   */
  private getPluginType(pluginPath: string): PluginType | null {
    const parts = pluginPath.split('/');
    if (parts.length < 2) return null;

    // The second-to-last directory determines the type
    // e.g., "prompt-line-plugins/agent-skills/claude-commands" → parts[1] = "agent-skills"
    const typeDir = parts[parts.length - 2];
    if (typeDir === 'agent-skills') return 'agent-skills';
    if (typeDir === 'custom-search') return 'custom-search';
    if (typeDir === 'built-in-commands') return 'built-in-commands';
    return null;
  }

  /**
   * Load a single plugin by its relative path
   */
  /**
   * Validate that a plugin path stays within the plugins directory
   */
  private validatePluginPath(pluginPath: string): string | null {
    // Reject paths with traversal or absolute paths
    if (pluginPath.includes('..') || path.isAbsolute(pluginPath)) {
      logger.warn(`Invalid plugin path rejected: ${pluginPath}`);
      return null;
    }

    const resolvedPath = path.resolve(this.pluginsDir, pluginPath);
    const normalizedBase = path.resolve(this.pluginsDir);
    if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
      logger.warn(`Plugin path traversal attempt blocked: ${pluginPath}`);
      return null;
    }

    return resolvedPath;
  }

  private loadPlugin(pluginPath: string): LoadedPlugin | null {
    // Check cache first
    const cached = this.cache.get(pluginPath);
    if (cached) return cached;

    const type = this.getPluginType(pluginPath);
    if (!type) {
      logger.warn(`Unknown plugin type for path: ${pluginPath}`);
      return null;
    }

    // Validate plugin path stays within plugins directory
    const validatedBase = this.validatePluginPath(pluginPath);
    if (!validatedBase) return null;

    const filePath = validatedBase + '.yml';
    if (!fs.existsSync(filePath)) {
      // Try .yaml extension
      const yamlPath = validatedBase + '.yaml';
      if (!fs.existsSync(yamlPath)) {
        logger.debug(`Plugin file not found: ${filePath}`);
        return null;
      }
      return this.parsePlugin(yamlPath, pluginPath, type);
    }

    return this.parsePlugin(filePath, pluginPath, type);
  }

  /**
   * Parse a plugin YAML file
   */
  private parsePlugin(filePath: string, pluginPath: string, type: PluginType): LoadedPlugin | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Use JSON_SCHEMA to prevent arbitrary code execution from malicious YAML
      const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA });

      if (!parsed || typeof parsed !== 'object') {
        logger.warn(`Invalid YAML in plugin file: ${filePath}`);
        return null;
      }

      const plugin: LoadedPlugin = {
        pluginPath,
        type,
        entries: [],
        builtInCommands: []
      };

      if (type === 'built-in-commands') {
        plugin.builtInCommands = this.parseBuiltInCommands(parsed as BuiltInCommandsYaml, filePath);
      } else {
        const entry = this.parsePluginEntry(parsed as PluginEntryYaml, type);
        if (entry) {
          plugin.entries = [entry];
        }
      }

      this.cache.set(pluginPath, plugin);
      return plugin;
    } catch (error) {
      logger.warn(`Failed to parse plugin file: ${filePath}`, error);
      return null;
    }
  }

  /**
   * Convert a plugin YAML to CustomSearchEntry
   */
  private parsePluginEntry(yamlData: PluginEntryYaml, type: PluginType): CustomSearchEntry | null {
    if (!yamlData.name || !yamlData.path || !yamlData.pattern) {
      return null;
    }

    const entryType = type === 'agent-skills' ? 'command' : 'mention';

    const entry: CustomSearchEntry = {
      type: entryType,
      name: yamlData.name,
      description: yamlData.description || '',
      path: yamlData.path,
      pattern: yamlData.pattern,
    };

    // Copy optional fields
    if (yamlData.label !== undefined) entry.label = yamlData.label;
    if (yamlData.color !== undefined) entry.color = yamlData.color;
    if (yamlData.icon !== undefined) entry.icon = yamlData.icon;
    if (yamlData.argumentHint !== undefined) entry.argumentHint = yamlData.argumentHint;
    if (yamlData.maxSuggestions !== undefined) entry.maxSuggestions = yamlData.maxSuggestions;
    if (yamlData.orderBy !== undefined) entry.orderBy = yamlData.orderBy;
    if (yamlData.values !== undefined) entry.values = yamlData.values;
    if (yamlData.prefixPattern !== undefined) entry.prefixPattern = yamlData.prefixPattern;
    if (yamlData.triggers !== undefined) entry.triggers = yamlData.triggers;
    // custom-search specific
    if (yamlData.searchPrefix !== undefined) entry.searchPrefix = yamlData.searchPrefix;
    if (yamlData.displayTime !== undefined) entry.displayTime = yamlData.displayTime;
    if (yamlData.inputFormat !== undefined) entry.inputFormat = yamlData.inputFormat;
    if (yamlData.command !== undefined) entry.command = yamlData.command;

    return entry;
  }

  /**
   * Parse built-in commands YAML (existing format with commands: array)
   */
  private parseBuiltInCommands(yamlData: BuiltInCommandsYaml, filePath: string): AgentSkillItem[] {
    if (!yamlData?.commands || !Array.isArray(yamlData.commands)) {
      return [];
    }

    const toolName = path.basename(filePath, path.extname(filePath));
    const displayName = yamlData.name || toolName;
    const reference = yamlData.reference;
    const defaultColor = yamlData.color;

    return yamlData.commands
      .filter(cmd => cmd.name && cmd.description)
      .map(cmd => {
        const rawColor = cmd.color || defaultColor;
        const color = rawColor ? validateColorValue(rawColor) : undefined;

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
          source: toolName,
          displayName: displayName
        };

        if (cmd['argument-hint']) {
          item.argumentHint = cmd['argument-hint'];
        }
        if (color) {
          item.color = color;
        }

        return item;
      });
  }

  /**
   * Load all enabled plugins and return CustomSearchEntry[] for agent-skills/custom-search
   */
  loadPluginEntries(enabledPlugins: string[]): CustomSearchEntry[] {
    const entries: CustomSearchEntry[] = [];

    for (const pluginPath of enabledPlugins) {
      const type = this.getPluginType(pluginPath);
      if (type === 'built-in-commands') continue; // handled separately

      const plugin = this.loadPlugin(pluginPath);
      if (plugin) {
        entries.push(...plugin.entries);
      }
    }

    return entries;
  }

  /**
   * Load all enabled built-in command plugins and return AgentSkillItem[]
   */
  loadBuiltInCommands(enabledPlugins: string[]): AgentSkillItem[] {
    const commands: AgentSkillItem[] = [];

    for (const pluginPath of enabledPlugins) {
      const type = this.getPluginType(pluginPath);
      if (type !== 'built-in-commands') continue;

      const plugin = this.loadPlugin(pluginPath);
      if (plugin) {
        commands.push(...plugin.builtInCommands);
      }
    }

    return commands;
  }

  /**
   * Search built-in commands with optional query filter
   */
  searchBuiltInCommands(enabledPlugins: string[], query?: string): AgentSkillItem[] {
    let commands = this.loadBuiltInCommands(enabledPlugins);

    if (query && query.trim() !== '') {
      const lowerQuery = query.toLowerCase();
      commands = commands.filter(cmd =>
        cmd.name.toLowerCase().startsWith(lowerQuery)
      );
    }

    return commands;
  }

  /**
   * Clear the cache to force reload
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Plugin loader cache cleared');
  }
}

// Singleton instance
const pluginLoader = new PluginLoader();

export default pluginLoader;
export { PluginLoader };
