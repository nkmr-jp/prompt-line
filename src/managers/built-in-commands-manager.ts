import fs from 'fs';
import path from 'path';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';

/**
 * Manages built-in slash commands for CLI tools (Claude Code, etc.)
 * Copies YAML definition files to user data directory for BuiltInCommandsLoader
 */
class BuiltInCommandsManager {
  private sourceDir: string;
  private targetDir: string;

  constructor() {
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
        if (this.copyYamlFile(file)) {
          copiedCount++;
        }
      }

      logger.info('Built-in commands initialized', {
        sourceDir: this.sourceDir,
        targetDir: this.targetDir,
        copiedFiles: copiedCount
      });
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
}

export default BuiltInCommandsManager;
