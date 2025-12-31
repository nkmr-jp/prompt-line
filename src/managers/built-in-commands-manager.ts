import fs from 'fs';
import path from 'path';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';

/**
 * Manages built-in slash commands for Claude Code
 * Copies bundled command files to user data directory on startup
 */
class BuiltInCommandsManager {
  private sourceDir: string;
  private targetDir: string;

  constructor() {
    // Source: bundled assets in app resources
    // In development: assets/built-in-commands
    // In production: app.asar.unpacked/assets/built-in-commands or similar
    this.sourceDir = this.getSourceDirectory();
    this.targetDir = config.paths.builtInCommandsDir;
  }

  /**
   * Get the source directory for built-in commands
   * Handles both development and production environments
   */
  private getSourceDirectory(): string {
    // Default development path
    const defaultPath = path.join(__dirname, '..', '..', 'assets', 'built-in-commands');

    // Try multiple possible locations
    const possiblePaths: string[] = [
      // Development: relative to dist/managers
      defaultPath,
      // Production: in app.asar.unpacked
      path.join(__dirname, '..', '..', 'app.asar.unpacked', 'assets', 'built-in-commands'),
      // Another alternative
      path.join(__dirname, '..', 'assets', 'built-in-commands'),
    ];

    // Add resourcesPath if available
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

    // Default to development path
    logger.warn('Built-in commands source directory not found, using default path');
    return defaultPath;
  }

  /**
   * Initialize built-in commands
   * Copies command files to user data directory if needed
   */
  async initialize(): Promise<void> {
    try {
      // Ensure target directory exists
      await ensureDir(this.targetDir);

      // Check if source directory exists
      if (!fs.existsSync(this.sourceDir)) {
        logger.warn('Built-in commands source directory does not exist:', this.sourceDir);
        return;
      }

      // Copy command files
      await this.copyCommandFiles();

      logger.info('Built-in commands initialized', {
        sourceDir: this.sourceDir,
        targetDir: this.targetDir
      });
    } catch (error) {
      logger.error('Failed to initialize built-in commands:', error);
      // Don't throw - this is not a critical failure
    }
  }

  /**
   * Copy command files from source to target directory
   * Overwrites existing files to ensure latest versions
   */
  private async copyCommandFiles(): Promise<void> {
    const files = fs.readdirSync(this.sourceDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    let copiedCount = 0;
    for (const file of mdFiles) {
      const sourcePath = path.join(this.sourceDir, file);
      const targetPath = path.join(this.targetDir, file);

      try {
        // Read source file
        const content = fs.readFileSync(sourcePath, 'utf-8');

        // Write to target (overwrite if exists)
        fs.writeFileSync(targetPath, content, 'utf-8');
        copiedCount++;
      } catch (error) {
        logger.warn(`Failed to copy built-in command file: ${file}`, error);
      }
    }

    logger.debug(`Copied ${copiedCount} built-in command files`);
  }

  /**
   * Get the target directory path for built-in commands
   */
  getTargetDirectory(): string {
    return this.targetDir;
  }
}

export default BuiltInCommandsManager;
