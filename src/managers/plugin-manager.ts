import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import chokidar, { type FSWatcher } from 'chokidar';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';
import pluginLoader from '../lib/plugin-loader';

/**
 * Manages plugin YAML files for all plugin types (agent-skills, custom-search, built-in-commands).
 * Copies default plugin files from assets to user data directory (hash-based versioning)
 * and watches for changes.
 *
 * Directory structure:
 *   ~/.prompt-line/plugins/<package>/<hash>/<type>/<name>.yml
 *   e.g., ~/.prompt-line/plugins/prompt-line-plugin/v0.28.7/agent-skills/claude-commands.yml
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
   * Get the version hash for the current app (used as directory name)
   */
  private getVersionHash(): string {
    return `v${config.app.version}`;
  }

  /**
   * Initialize plugin manager
   * Copies plugin files to user data directory (hash-based) and starts watcher
   */
  async initialize(): Promise<void> {
    try {
      await ensureDir(this.targetDir);

      if (!fs.existsSync(this.sourceDir)) {
        logger.warn('Plugins source directory does not exist:', this.sourceDir);
        return;
      }

      const hash = this.getVersionHash();
      let totalCopied = 0;

      // Skip source directory read if all packages are already installed for this version
      const packages = fs.readdirSync(this.sourceDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
      const allInstalled = packages.every(pkg =>
        fs.existsSync(path.join(this.targetDir, pkg.name, hash))
      );

      if (!allInstalled) {
        for (const pkg of packages) {
          const sourcePackageDir = path.join(this.sourceDir, pkg.name);
          const targetPackageDir = path.join(this.targetDir, pkg.name, hash);

          if (fs.existsSync(targetPackageDir)) {
            logger.debug(`Plugin version already installed: ${pkg.name}/${hash}`);
            continue;
          }

          totalCopied += this.copyDirectoryRecursive(sourcePackageDir, targetPackageDir);
        }
      }

      logger.info('Plugins initialized', {
        sourceDir: this.sourceDir,
        targetDir: this.targetDir,
        hash,
        copiedFiles: totalCopied
      });

      this.startWatching();
    } catch (error) {
      logger.error('Failed to initialize plugins:', error);
    }
  }

  /**
   * Recursively copy directory contents
   */
  private copyDirectoryRecursive(source: string, target: string): number {
    let copiedCount = 0;

    if (!fs.existsSync(source)) return copiedCount;

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
        try {
          fs.copyFileSync(sourcePath, targetPath);
          copiedCount++;
          logger.info(`Copied plugin file: ${path.relative(this.sourceDir, sourcePath)}`);
        } catch (error) {
          logger.warn(`Failed to copy plugin file: ${entry.name}`, error);
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
