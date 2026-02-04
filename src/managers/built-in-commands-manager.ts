import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import chokidar, { type FSWatcher } from 'chokidar';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';
import builtInCommandsLoader from '../lib/built-in-commands-loader';

/**
 * Manages built-in slash commands for CLI tools (Claude Code, etc.)
 * Copies YAML definition files to user data directory for BuiltInCommandsLoader
 */
class BuiltInCommandsManager extends EventEmitter {
  private sourceDir: string;
  private targetDir: string;
  private watcher: FSWatcher | null = null;
  private reloadDebounceTimer: NodeJS.Timeout | null = null;
  private readonly RELOAD_DEBOUNCE_MS = 300;

  constructor() {
    super();
    this.sourceDir = this.getSourceDirectory();
    this.targetDir = config.paths.builtInCommandsDir;
  }

  /**
   * Get the source directory for built-in command YAML files
   * Handles both development and production environments
   */
  private getSourceDirectory(): string {
    const defaultPath = path.join(__dirname, '..', '..', 'assets', 'built-in-commands');

    const possiblePaths: string[] = [
      defaultPath,
      path.join(__dirname, '..', '..', 'app.asar.unpacked', 'assets', 'built-in-commands'),
      path.join(__dirname, '..', 'assets', 'built-in-commands'),
    ];

    if (process.resourcesPath) {
      possiblePaths.push(
        path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'built-in-commands')
      );
    }

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        logger.debug('Found built-in commands source directory:', p);
        return p;
      }
    }

    logger.warn('Built-in commands source directory not found, using default path');
    return defaultPath;
  }

  /**
   * Initialize built-in commands
   * Copies YAML files to user data directory
   */
  async initialize(): Promise<void> {
    try {
      await ensureDir(this.targetDir);

      if (!fs.existsSync(this.sourceDir)) {
        logger.warn('Built-in commands source directory does not exist:', this.sourceDir);
        return;
      }

      // Copy all YAML files to target directory
      const files = fs.readdirSync(this.sourceDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      let copiedCount = 0;
      for (const file of yamlFiles) {
        const targetPath = path.join(this.targetDir, file);

        if (!fs.existsSync(targetPath)) {
          if (this.copyYamlFile(file)) {
            copiedCount++;
            logger.info(`Copied new built-in commands file: ${file}`);
          }
        } else {
          logger.debug(`Skipping existing file (user may have customized): ${file}`);
        }
      }

      logger.info('Built-in commands initialized', {
        sourceDir: this.sourceDir,
        targetDir: this.targetDir,
        copiedFiles: copiedCount
      });

      // Start file watcher
      this.startWatching();
    } catch (error) {
      logger.error('Failed to initialize built-in commands:', error);
    }
  }

  /**
   * Copy a YAML file from source to target directory
   */
  private copyYamlFile(filename: string): boolean {
    const sourcePath = path.join(this.sourceDir, filename);
    const targetPath = path.join(this.targetDir, filename);

    try {
      fs.copyFileSync(sourcePath, targetPath);
      logger.debug(`Copied built-in commands file: ${filename}`);
      return true;
    } catch (error) {
      logger.warn(`Failed to copy YAML file: ${filename}`, error);
      return false;
    }
  }

  /**
   * Get the target directory path for built-in commands
   */
  getTargetDirectory(): string {
    return this.targetDir;
  }

  /**
   * Start file watcher for built-in commands directory
   */
  private startWatching(): void {
    if (this.watcher) {
      logger.debug('Built-in commands watcher already initialized');
      return;
    }

    this.watcher = chokidar.watch(this.targetDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      // Only watch YAML files
      ignored: (filePath: string, stats?: fs.Stats) => {
        // Check if stats is provided and it's a directory
        if (stats && stats.isDirectory()) {
          return false;
        }

        // If no stats, check if path has no extension (likely a directory)
        const ext = path.extname(filePath);
        if (!ext) {
          return false;
        }

        // Ignore files that are not YAML files
        return ext !== '.yaml' && ext !== '.yml';
      }
    });

    this.watcher.on('change', (filePath: string) => {
      logger.debug('Built-in commands file changed:', filePath);
      this.handleFileChange();
    });

    this.watcher.on('add', (filePath: string) => {
      logger.debug('Built-in commands file added:', filePath);
      this.handleFileChange();
    });

    this.watcher.on('unlink', (filePath: string) => {
      logger.debug('Built-in commands file removed:', filePath);
      this.handleFileChange();
    });

    this.watcher.on('error', (error: unknown) => {
      logger.error('Built-in commands watcher error:', error);
    });

    logger.info('Built-in commands file watcher started');
  }

  /**
   * File change handler with debounce
   */
  private handleFileChange(): void {
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }

    this.reloadDebounceTimer = setTimeout(() => {
      // Clear cache to trigger reload on next request
      builtInCommandsLoader.clearCache();

      // Emit event for listeners (e.g., MdSearchHandler)
      this.emit('commands-changed');

      logger.info('Built-in commands reloaded from file change');
    }, this.RELOAD_DEBOUNCE_MS);
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      logger.info('Built-in commands watcher closed');
    }

    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
      this.reloadDebounceTimer = null;
    }

    this.removeAllListeners();
  }
}

export default BuiltInCommandsManager;
