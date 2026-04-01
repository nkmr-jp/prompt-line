import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import config from '../config/app-config';
import { logger, validateColorValue } from '../utils/utils';
import type { AgentSkillItem, AgentItem, CustomSearchEntry, ColorValue } from '../types/window';

/**
 * Plugin type determined by directory name
 */
type PluginType = 'agent-skills' | 'custom-search' | 'agent-built-in';

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
  excludeMarker?: string;
}

/**
 * YAML structure for agent built-in plugins
 */
interface AgentBuiltInCommandYaml {
  name: string;
  description: string;
  'argument-hint'?: string;
  color?: ColorValue;
}

interface AgentBuiltInYaml {
  name?: string;
  reference?: string;
  references?: string[];
  color?: ColorValue;
  commands?: AgentBuiltInCommandYaml[];
  skills?: AgentBuiltInCommandYaml[];
  agents?: Array<{
    name: string;
    description: string;
  }>;
}

/**
 * Loaded plugin data
 */
interface LoadedPlugin {
  pluginPath: string;  // relative path (e.g., "github.com/nkmr-jp/prompt-line-plugins/claude/agent-skills/commands")
  type: PluginType;
  entries: CustomSearchEntry[];
  agentBuiltIn: AgentSkillItem[];
  agentBuiltInAgents: AgentItem[];
}

/**
 * Unified plugin loader for all plugin types.
 * Reads YAML files from ~/.prompt-line/plugins/ and converts them to
 * CustomSearchEntry[] (for agent-skills/custom-search) or AgentSkillItem[] (for agent-built-in).
 *
 * Directory structure:
 *   ~/.prompt-line/plugins/<package>/<type>/<name>.yaml
 *   e.g., ~/.prompt-line/plugins/github.com/nkmr-jp/prompt-line-plugins/claude/agent-skills/commands.yaml
 *
 * Plugin paths in settings.yaml use the format: <package>/<type>/<name>
 */
class PluginLoader {
  private cache: Map<string, LoadedPlugin> = new Map();
  private pluginsDir: string;

  constructor() {
    this.pluginsDir = config.paths.pluginsDir;
  }

  /**
   * Determine plugin type from the relative path
   * e.g., "github.com/nkmr-jp/prompt-line-plugins/claude/agent-skills/commands" → 'agent-skills'
   */
  private getPluginType(pluginPath: string): PluginType | null {
    const parts = pluginPath.split('/');
    if (parts.length < 2) return null;

    const typeDir = parts[parts.length - 2];
    if (typeDir === 'agent-skills') return 'agent-skills';
    if (typeDir === 'custom-search') return 'custom-search';
    if (typeDir === 'agent-built-in') return 'agent-built-in';
    return null;
  }

  /**
   * Resolve a plugin path to an actual file path.
   * Input:  "github.com/nkmr-jp/prompt-line-plugins/claude/agent-skills/commands"
   * Output: "/home/user/.prompt-line/plugins/github.com/nkmr-jp/prompt-line-plugins/claude/agent-skills/commands"
   */
  private resolvePluginBasePath(pluginPath: string): string | null {
    // Reject paths with traversal or absolute paths
    if (pluginPath.includes('..') || path.isAbsolute(pluginPath)) {
      logger.warn(`Invalid plugin path rejected: ${pluginPath}`);
      return null;
    }

    const parts = pluginPath.split('/');
    if (parts.length < 3) {
      logger.warn(`Invalid plugin path format: ${pluginPath}`);
      return null;
    }

    const resolved = path.resolve(this.pluginsDir, pluginPath);
    const normalizedBase = path.resolve(this.pluginsDir);
    if (resolved.startsWith(normalizedBase + path.sep)) {
      return resolved;
    }

    logger.warn(`Plugin path traversal attempt blocked: ${pluginPath}`);
    return null;
  }

  /**
   * Load a single plugin by its relative path
   */
  private loadPlugin(pluginPath: string): LoadedPlugin | null {
    // Check cache first
    const cached = this.cache.get(pluginPath);
    if (cached) return cached;

    const type = this.getPluginType(pluginPath);
    if (!type) {
      logger.warn(`Unknown plugin type for path: ${pluginPath}`);
      return null;
    }

    const basePath = this.resolvePluginBasePath(pluginPath);
    if (!basePath) return null;

    // Try .yaml first, then .yml — parsePlugin handles missing files gracefully
    const result = this.parsePlugin(basePath + '.yaml', pluginPath, type)
      ?? this.parsePlugin(basePath + '.yml', pluginPath, type);
    if (!result) {
      logger.debug(`Plugin file not found: ${basePath}.yaml`);
    }
    return result;
  }

  /**
   * Read and parse a YAML file safely.
   * Uses JSON_SCHEMA to prevent arbitrary code execution from malicious YAML.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readYamlFile(filePath: string): any {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA });
      if (!parsed || typeof parsed !== 'object') {
        logger.warn(`Invalid YAML in file: ${filePath}`);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Parse a plugin YAML file
   */
  private parsePlugin(filePath: string, pluginPath: string, type: PluginType): LoadedPlugin | null {
    const parsed = this.readYamlFile(filePath);
    if (!parsed) return null;

    const plugin: LoadedPlugin = {
      pluginPath,
      type,
      entries: [],
      agentBuiltIn: [],
      agentBuiltInAgents: []
    };

    if (type === 'agent-built-in') {
      const yamlData = parsed as AgentBuiltInYaml;
      plugin.agentBuiltIn = this.parseAgentBuiltIn(yamlData, filePath);
      plugin.agentBuiltInAgents = this.parseAgentBuiltInAgents(yamlData, filePath);
    } else {
      const entry = this.parsePluginEntry(parsed as PluginEntryYaml, type);
      if (entry) {
        plugin.entries = [entry];
      }
    }

    this.cache.set(pluginPath, plugin);
    return plugin;
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
      description: (yamlData.description || '').replace(/\n+/g, ' ').trim(),
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
    if (yamlData.excludeMarker !== undefined) entry.excludeMarker = yamlData.excludeMarker;

    return entry;
  }

  /**
   * Resolve reference URLs from both legacy `reference` (string) and new `references` (string[]).
   * When `references` array is present, it takes precedence over legacy `reference`.
   */
  private resolveReferences(yamlData: AgentBuiltInYaml): string[] {
    if (Array.isArray(yamlData.references)) {
      return yamlData.references.filter(r => typeof r === 'string' && r.trim() !== '');
    }
    if (yamlData.reference) {
      return [yamlData.reference];
    }
    return [];
  }

  /**
   * Extract common context from agent-built-in YAML data
   */
  private resolvePluginContext(yamlData: AgentBuiltInYaml, filePath: string) {
    const toolName = path.basename(filePath, path.extname(filePath));
    return {
      toolName,
      displayName: yamlData.name || toolName,
      references: this.resolveReferences(yamlData),
      defaultColor: yamlData.color,
    };
  }

  /**
   * Build frontmatter lines with description, source, optional fields, and references
   */
  private buildFrontmatterLines(
    description: string,
    displayName: string,
    color: ColorValue | undefined,
    references: string[],
    options?: { argumentHint?: string; isSkill?: boolean }
  ): string[] {
    const lines = [
      `description: ${description.replace(/\n+/g, ' ').trim()}`,
      `source: ${displayName}`,
    ];
    if (options?.isSkill) {
      lines.push('type: skill');
    }
    if (options?.argumentHint) {
      lines.push(`argument-hint: ${options.argumentHint}`);
    }
    if (color) {
      lines.push(`color: ${color}`);
    }
    for (const ref of references) {
      lines.push(`reference: ${ref}`);
    }
    return lines;
  }

  /**
   * Parse agent built-in YAML commands and skills into AgentSkillItem[]
   */
  private parseAgentBuiltIn(yamlData: AgentBuiltInYaml, filePath: string): AgentSkillItem[] {
    const commands = Array.isArray(yamlData?.commands) ? yamlData.commands : [];
    const skills = Array.isArray(yamlData?.skills) ? yamlData.skills : [];
    if (commands.length === 0 && skills.length === 0) {
      return [];
    }

    const { toolName, displayName, references, defaultColor } = this.resolvePluginContext(yamlData, filePath);

    const mapEntry = (cmd: AgentBuiltInCommandYaml, icon?: string): AgentSkillItem | null => {
      if (!cmd.name || !cmd.description) return null;

      const rawColor = cmd.color || defaultColor;
      const color = rawColor ? validateColorValue(rawColor) : undefined;
      const frontmatterLines = this.buildFrontmatterLines(
        cmd.description, displayName, color, references,
        { ...(cmd['argument-hint'] ? { argumentHint: cmd['argument-hint'] } : {}), isSkill: !!icon }
      );

      const item: AgentSkillItem = {
        name: cmd.name,
        description: (cmd.description || '').replace(/\n+/g, ' ').trim(),
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
      if (icon) {
        item.icon = icon;
      }

      return item;
    };

    const results: AgentSkillItem[] = [];
    for (const cmd of commands) {
      const item = mapEntry(cmd);
      if (item) results.push(item);
    }
    for (const cmd of skills) {
      const item = mapEntry(cmd, 'codicon-edit-sparkle');
      if (item) results.push(item);
    }
    return results;
  }

  /**
   * Parse agent built-in YAML agents section into AgentItem[]
   */
  private parseAgentBuiltInAgents(yamlData: AgentBuiltInYaml, filePath: string): AgentItem[] {
    if (!Array.isArray(yamlData?.agents) || yamlData.agents.length === 0) {
      return [];
    }

    const { displayName, references, defaultColor } = this.resolvePluginContext(yamlData, filePath);
    const color = defaultColor ? validateColorValue(defaultColor) : undefined;

    return yamlData.agents
      .filter(agent => agent.name && agent.description)
      .map(agent => {
        const frontmatterLines = this.buildFrontmatterLines(agent.description, displayName, color, references);

        const item: AgentItem = {
          name: agent.name,
          description: (agent.description || '').replace(/\n+/g, ' ').trim(),
          filePath: filePath,
          frontmatter: frontmatterLines.join('\n'),
          label: displayName,
        };
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
      if (type === 'agent-built-in') continue; // handled separately

      const plugin = this.loadPlugin(pluginPath);
      if (plugin) {
        entries.push(...plugin.entries);
      }
    }

    return entries;
  }

  /**
   * Collect items from all agent-built-in plugins using a field selector
   */
  private collectFromAgentBuiltIn<T>(enabledPlugins: string[], pick: (plugin: LoadedPlugin) => T[]): T[] {
    const results: T[] = [];
    for (const pluginPath of enabledPlugins) {
      if (this.getPluginType(pluginPath) !== 'agent-built-in') continue;
      const plugin = this.loadPlugin(pluginPath);
      if (plugin) results.push(...pick(plugin));
    }
    return results;
  }

  /**
   * Load all enabled agent-built-in plugins and return AgentSkillItem[]
   */
  loadAgentBuiltIn(enabledPlugins: string[]): AgentSkillItem[] {
    return this.collectFromAgentBuiltIn(enabledPlugins, p => p.agentBuiltIn);
  }

  /**
   * Search agent built-in with optional query filter
   */
  searchAgentBuiltIn(enabledPlugins: string[], query?: string): AgentSkillItem[] {
    return this.filterByQuery(this.loadAgentBuiltIn(enabledPlugins), query);
  }

  /**
   * Load all enabled agent-built-in plugins and return AgentItem[] from their agents sections
   */
  loadAgentBuiltInAgents(enabledPlugins: string[]): AgentItem[] {
    return this.collectFromAgentBuiltIn(enabledPlugins, p => p.agentBuiltInAgents);
  }

  /**
   * Search agent built-in agents with optional query filter
   */
  searchAgentBuiltInAgents(enabledPlugins: string[], query?: string): AgentItem[] {
    return this.filterByQuery(this.loadAgentBuiltInAgents(enabledPlugins), query);
  }

  /**
   * Load an agent-skills YAML file from ~/.prompt-line/agent-skills/{name}.yaml
   * Returns a CustomSearchEntry with type 'command', or null if not found/invalid.
   */
  loadAgentSkillFile(name: string): CustomSearchEntry | null {
    return this.loadStandaloneFile(name, config.paths.agentSkillsDir, 'agent-skills');
  }

  /**
   * Load a custom-search YAML file from ~/.prompt-line/custom-search/{name}.yaml
   * Returns a CustomSearchEntry with type 'mention', or null if not found/invalid.
   */
  loadCustomSearchFile(name: string): CustomSearchEntry | null {
    return this.loadStandaloneFile(name, config.paths.customSearchDir, 'custom-search');
  }

  /**
   * Validate that a name doesn't contain path traversal or absolute paths
   */
  private isInvalidName(name: string): boolean {
    return name.includes('..') || name.includes('/') || name.includes('\\') || path.isAbsolute(name);
  }

  /**
   * Read a YAML file by name, trying .yaml then .yml extension
   */
  private readYamlByName(dir: string, name: string): { parsed: unknown; filePath: string } | null {
    const basePath = path.join(dir, name);
    const yamlPath = basePath + '.yaml';
    const parsedYaml = this.readYamlFile(yamlPath);
    if (parsedYaml) return { parsed: parsedYaml, filePath: yamlPath };
    const ymlPath = basePath + '.yml';
    const parsedYml = this.readYamlFile(ymlPath);
    if (parsedYml) return { parsed: parsedYml, filePath: ymlPath };
    return null;
  }

  /**
   * Filter items by query prefix (case-insensitive)
   */
  private filterByQuery<T extends { name: string }>(items: T[], query?: string): T[] {
    if (!query || query.trim() === '') return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(item => item.name.toLowerCase().startsWith(lowerQuery));
  }

  /**
   * Load a standalone YAML file from a directory by name.
   * Reuses parsePluginEntry for consistent field handling.
   */
  private loadStandaloneFile(name: string, dir: string, type: PluginType): CustomSearchEntry | null {
    if (this.isInvalidName(name)) {
      logger.warn(`Invalid standalone entry name rejected: ${name}`);
      return null;
    }

    const cacheKey = `standalone:${type}:${name}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached.entries[0] ?? null;

    const result = this.readYamlByName(dir, name);
    const entry = result ? this.parsePluginEntry(result.parsed as PluginEntryYaml, type) : null;
    const basePath = path.join(dir, name);

    // Cache both hits and misses to avoid repeated I/O for invalid names
    this.cache.set(cacheKey, { pluginPath: cacheKey, type, entries: entry ? [entry] : [], agentBuiltIn: [], agentBuiltInAgents: [] });
    if (!entry) {
      logger.debug(`Standalone ${type} file not found: ${basePath}.yaml`);
    }
    return entry;
  }

  /**
   * Load agent built-in from ~/.prompt-line/agent-built-in/ directory.
   * Reads YAML files matching the given names (e.g., ["claude-ja"] → claude-ja.yaml).
   * Used for the agentBuiltIn setting (backward-compatible with pre-plugin system).
   */
  loadLegacyAgentBuiltIn(names: string[]): AgentSkillItem[] {
    const commands: AgentSkillItem[] = [];
    const dir = config.paths.agentBuiltInDir;

    for (const name of names) {
      if (this.isInvalidName(name)) {
        logger.warn(`Invalid agent built-in name rejected: ${name}`);
        continue;
      }

      const cacheKey = `legacy-built-in:${name}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        commands.push(...cached.agentBuiltIn);
        continue;
      }

      const result = this.readYamlByName(dir, name);
      const items = result ? this.parseAgentBuiltIn(result.parsed as AgentBuiltInYaml, result.filePath) : [];

      this.cache.set(cacheKey, { pluginPath: cacheKey, type: 'agent-built-in', entries: [], agentBuiltIn: items, agentBuiltInAgents: [] });
      commands.push(...items);
    }

    return commands;
  }

  /**
   * Search legacy agent built-in with optional query filter
   */
  searchLegacyAgentBuiltIn(names?: string[], query?: string): AgentSkillItem[] {
    if (!names || names.length === 0) return [];
    return this.filterByQuery(this.loadLegacyAgentBuiltIn(names), query);
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
