import type { Stats } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import chokidar, { type FSWatcher } from 'chokidar';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';
import pluginLoader from '../lib/plugin-loader';

/**
 * Manages plugin YAML files for all plugin types (agent-skills, custom-search, agent-built-in).
 * Watches for changes in user data directory and emits reload events.
 * Plugins are installed via `pnpm run plugin:install` from external repositories.
 *
 * Directory structure:
 *   ~/.prompt-line/plugins/<package>/<type>/<name>.yml
 *   e.g., ~/.prompt-line/plugins/github.com/nkmr-jp/prompt-line-plugins/claude/agent-skills/commands.yml
 */
class PluginManager extends EventEmitter {
  private targetDir: string;
  private watcher: FSWatcher | null = null;
  private reloadDebounceTimer: NodeJS.Timeout | null = null;
  private readonly RELOAD_DEBOUNCE_MS = 300;

  constructor() {
    super();
    this.targetDir = config.paths.pluginsDir;
  }

  /**
   * Initialize plugin manager
   * Ensures plugin directories exist and starts watcher
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        ensureDir(this.targetDir),
        ensureDir(config.paths.agentSkillsDir),
        ensureDir(config.paths.customSearchDir),
      ]);

      logger.info('Plugins initialized', {
        targetDir: this.targetDir,
      });

      this.startWatching();
    } catch (error) {
      logger.error('Failed to initialize plugins:', error);
    }
  }

  /**
   * Get the target directory path for plugins
   */
  getTargetDirectory(): string {
    return this.targetDir;
  }

  /**
   * Start file watcher for plugins directory
   */
  private startWatching(): void {
    if (this.watcher) {
      logger.debug('Plugins watcher already initialized');
      return;
    }

    this.watcher = chokidar.watch([this.targetDir, config.paths.agentSkillsDir, config.paths.customSearchDir], {
      persistent: true,
      ignoreInitial: true,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      ignored: (filePath: string, stats?: Stats) => {
        if (stats && stats.isDirectory()) return false;
        const ext = path.extname(filePath);
        if (!ext) return false;
        return ext !== '.yaml' && ext !== '.yml';
      }
    });

    this.watcher.on('change', (filePath: string) => {
      logger.debug('Plugin file changed:', filePath);
      this.handleFileChange();
    });

    this.watcher.on('add', (filePath: string) => {
      logger.debug('Plugin file added:', filePath);
      this.handleFileChange();
    });

    this.watcher.on('unlink', (filePath: string) => {
      logger.debug('Plugin file removed:', filePath);
      this.handleFileChange();
    });

    this.watcher.on('error', (error: unknown) => {
      logger.error('Plugins watcher error:', error);
    });

    logger.info('Plugins file watcher started');
  }

  /**
   * File change handler with debounce
   */
  private handleFileChange(): void {
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }

    this.reloadDebounceTimer = setTimeout(() => {
      pluginLoader.clearCache();
      this.emit('plugins-changed');
      logger.info('Plugins reloaded from file change');
    }, this.RELOAD_DEBOUNCE_MS);
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    // Clear timer first to prevent post-destroy events
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
      this.reloadDebounceTimer = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      logger.info('Plugins watcher closed');
    }

    this.removeAllListeners();
  }
}

export default PluginManager;
