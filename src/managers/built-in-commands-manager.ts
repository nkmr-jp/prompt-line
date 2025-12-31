import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';

/**
 * Command definition in YAML file
 */
interface CommandDefinition {
  name: string;
  description: string;
  'argument-hint'?: string;
}

/**
 * YAML file structure for built-in commands
 */
interface BuiltInCommandsYaml {
  commands: CommandDefinition[];
}

/**
 * Manages built-in slash commands for CLI tools (Claude Code, etc.)
 * Reads YAML definition files and generates md files for autocomplete
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
   * Reads YAML files and generates md files in user data directory
   */
  async initialize(): Promise<void> {
    try {
      await ensureDir(this.targetDir);

      if (!fs.existsSync(this.sourceDir)) {
        logger.warn('Built-in commands source directory does not exist:', this.sourceDir);
        return;
      }

      // Process all YAML files in source directory
      const files = fs.readdirSync(this.sourceDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      let totalCommands = 0;
      for (const file of yamlFiles) {
        const count = await this.processYamlFile(file);
        totalCommands += count;
      }

      logger.info('Built-in commands initialized', {
        sourceDir: this.sourceDir,
        targetDir: this.targetDir,
        yamlFiles: yamlFiles.length,
        totalCommands
      });
    } catch (error) {
      logger.error('Failed to initialize built-in commands:', error);
    }
  }

  /**
   * Process a single YAML file and generate md files
   */
  private async processYamlFile(filename: string): Promise<number> {
    const sourcePath = path.join(this.sourceDir, filename);

    try {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      const parsed = yaml.load(content) as BuiltInCommandsYaml;

      if (!parsed?.commands || !Array.isArray(parsed.commands)) {
        logger.warn(`Invalid YAML structure in ${filename}`);
        return 0;
      }

      let generatedCount = 0;
      for (const cmd of parsed.commands) {
        if (this.generateMdFile(cmd)) {
          generatedCount++;
        }
      }

      logger.debug(`Processed ${filename}: ${generatedCount} commands`);
      return generatedCount;
    } catch (error) {
      logger.warn(`Failed to process YAML file: ${filename}`, error);
      return 0;
    }
  }

  /**
   * Generate a single md file from command definition
   */
  private generateMdFile(cmd: CommandDefinition): boolean {
    if (!cmd.name || !cmd.description) {
      logger.warn('Invalid command definition:', cmd);
      return false;
    }

    const targetPath = path.join(this.targetDir, `${cmd.name}.md`);

    // Build frontmatter
    const frontmatterLines = [
      '---',
      `description: ${cmd.description}`,
    ];

    if (cmd['argument-hint']) {
      frontmatterLines.push(`argument-hint: ${cmd['argument-hint']}`);
    }

    frontmatterLines.push('---', '');

    const content = frontmatterLines.join('\n');

    try {
      fs.writeFileSync(targetPath, content, 'utf-8');
      return true;
    } catch (error) {
      logger.warn(`Failed to generate md file: ${cmd.name}.md`, error);
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
