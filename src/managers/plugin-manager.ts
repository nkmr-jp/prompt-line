import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import chokidar, { type FSWatcher } from 'chokidar';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';
import pluginLoader from '../lib/plugin-loader';

/**
 * Manages plugin YAML files for all plugin types (agent-skills, custom-search, built-in-commands).
 * Copies default plugin files from assets to user data directory and watches for changes.
 */
class PluginManager extends EventEmitter {
  private sourceDir: string;
  private targetDir: string;
  private watcher: FSWatcher | null = null;
  private reloadDebounceTimer: NodeJS.Timeout | null = null;
  private readonly RELOAD_DEBOUNCE_MS = 300;

  constructor() {
    super();
    this.sourceDir = this.getSourceDirectory();
    this.targetDir = config.paths.pluginsDir;
  }

  /**
   * Get the source directory for plugin files
   * Handles both development and production environments
   */
  private getSourceDirectory(): string {
    const defaultPath = path.join(__dirname, '..', '..', 'assets', 'plugins');

    const possiblePaths: string[] = [
      defaultPath,
      path.join(__dirname, '..', '..', 'app.asar.unpacked', 'assets', 'plugins'),
      path.join(__dirname, '..', 'assets', 'plugins'),
    ];

    if (process.resourcesPath) {
      possiblePaths.push(
        path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'plugins')
      );
    }

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        logger.debug('Found plugins source directory:', p);
        return p;
      }
    }

    logger.warn('Plugins source directory not found, using default path');
    return defaultPath;
  }

  /**
   * Initialize plugin manager
   * Copies plugin files to user data directory and starts watcher
   */
  async initialize(): Promise<void> {
    try {
      await ensureDir(this.targetDir);

      if (!fs.existsSync(this.sourceDir)) {
        logger.warn('Plugins source directory does not exist:', this.sourceDir);
        return;
      }

      // Recursively copy plugin files
      const copiedCount = this.copyDirectoryRecursive(this.sourceDir, this.targetDir);

      logger.info('Plugins initialized', {
        sourceDir: this.sourceDir,
        targetDir: this.targetDir,
        copiedFiles: copiedCount
      });

      this.startWatching();
    } catch (error) {
      logger.error('Failed to initialize plugins:', error);
    }
  }

  /**
   * Recursively copy directory contents, skipping existing files
   */
  private copyDirectoryRecursive(source: string, target: string): number {
    let copiedCount = 0;

    if (!fs.existsSync(source)) return copiedCount;

    // Ensure target directory exists
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        copiedCount += this.copyDirectoryRecursive(sourcePath, targetPath);
      } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
        if (!fs.existsSync(targetPath)) {
          try {
            fs.copyFileSync(sourcePath, targetPath);
            copiedCount++;
            logger.info(`Copied new plugin file: ${path.relative(this.sourceDir, sourcePath)}`);
          } catch (error) {
            logger.warn(`Failed to copy plugin file: ${entry.name}`, error);
          }
        } else {
          logger.debug(`Skipping existing plugin file (user may have customized): ${path.relative(this.sourceDir, sourcePath)}`);
        }
      }
    }

    return copiedCount;
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

    this.watcher = chokidar.watch(this.targetDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      ignored: (filePath: string, stats?: fs.Stats) => {
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
