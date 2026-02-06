/**
 * File Searcher - Cross-platform file search using fd or Node.js fallback
 * Replaces native Swift file-searcher binary
 */

import { execFile } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { logger } from '../logger';
import type { FileSearchSettings, FileInfo, DirectoryInfo } from '../../types';

// Default exclude patterns
const DEFAULT_EXCLUDES = [
  // Dependencies
  'node_modules', 'vendor', 'bower_components', '.pnpm',
  // Build outputs
  '.next', '.nuxt', 'dist', 'build', 'out', 'target', '.output',
  // Version control
  '.git', '.svn', '.hg',
  // IDE
  '.idea', '.vscode', '.fleet',
  // Cache
  '.cache', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  // OS
  '.DS_Store', 'Thumbs.db',
  // Other
  'coverage', '.nyc_output', '.turbo', '.vercel', '.netlify'
];

const DEFAULT_TIMEOUT = 5000; // 5 seconds
const DEFAULT_MAX_BUFFER = 50 * 1024 * 1024; // 50MB

/**
 * Check if fd command is available
 */
export async function checkFdAvailable(): Promise<{ fdAvailable: boolean; fdPath: string | null }> {
  const fdPaths = [
    '/opt/homebrew/bin/fd',  // Apple Silicon Homebrew
    '/usr/local/bin/fd',     // Intel Homebrew
    '/usr/bin/fd',           // System
    'fd'                     // PATH
  ];

  for (const fdPath of fdPaths) {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile(fdPath, ['--version'], { timeout: 2000 }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      logger.debug('fd found', { fdPath });
      return { fdAvailable: true, fdPath };
    } catch (error) {
      logger.debug('fd not found at path', { fdPath, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
  }

  logger.debug('fd not available on system');
  return { fdAvailable: false, fdPath: null };
}

/**
 * Build fd command arguments from file search settings
 */
function buildFdArgs(settings: FileSearchSettings): string[] {
  const args: string[] = [
    '--type', 'f',           // Files only
    '--color', 'never',      // No color output
    '--absolute-path'        // Absolute paths
  ];

  // .gitignore setting
  if (!settings.respectGitignore) {
    args.push('--no-ignore');
    args.push('--no-ignore-vcs');
  }

  // Hidden files setting
  if (settings.includeHidden) {
    args.push('--hidden');
  }

  // Depth limit
  if (settings.maxDepth !== null && settings.maxDepth !== undefined) {
    args.push('--max-depth', String(settings.maxDepth));
  }

  // Exclude patterns
  const allExcludes = settings.includePatterns && settings.includePatterns.length > 0
    ? settings.excludePatterns
    : [...DEFAULT_EXCLUDES, ...settings.excludePatterns];

  for (const pattern of allExcludes) {
    args.push('--exclude', pattern);
  }

  // Search pattern (default to '.' to match all)
  args.push('.');

  return args;
}

/**
 * List files using fd command
 */
async function listFilesWithFd(
  directory: string,
  fdPath: string,
  settings: FileSearchSettings
): Promise<FileInfo[]> {
  return new Promise((resolve, reject) => {
    const args = buildFdArgs(settings);

    const options = {
      cwd: directory,
      timeout: DEFAULT_TIMEOUT,
      maxBuffer: DEFAULT_MAX_BUFFER,
      killSignal: 'SIGTERM' as const
    };

    execFile(fdPath, args, options, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          logger.warn('fd command timed out');
        }
        reject(error);
        return;
      }

      if (stderr) {
        logger.debug('fd stderr', { stderr });
      }

      // Parse output (each line is one file)
      const lines = stdout.split('\n').filter(line => line.trim());
      const files: FileInfo[] = [];

      for (const line of lines) {
        if (files.length >= settings.maxFiles) {
          break;
        }

        const filePath = line.trim();
        if (!filePath) {
          continue;
        }

        const name = basename(filePath);
        if (!name) {
          continue;
        }

        files.push({
          name,
          path: filePath,
          isDirectory: false
        });
      }

      resolve(files);
    });
  });
}

/**
 * Fallback: List files using Node.js fs.readdir (single level only)
 */
async function listFilesWithNodeFs(
  directory: string,
  settings: FileSearchSettings
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  const allExcludes = new Set([...DEFAULT_EXCLUDES, ...settings.excludePatterns]);

  try {
    const entries = await readdir(directory);

    for (const entry of entries) {
      if (files.length >= settings.maxFiles) {
        break;
      }

      // Skip hidden files unless explicitly included
      if (!settings.includeHidden && entry.startsWith('.')) {
        continue;
      }

      // Skip excluded patterns
      if (allExcludes.has(entry)) {
        continue;
      }

      const fullPath = join(directory, entry);

      try {
        const stats = await stat(fullPath);

        if (stats.isFile()) {
          files.push({
            name: entry,
            path: fullPath,
            isDirectory: false
          });
        }
      } catch (statError) {
        // Skip files we can't stat
        logger.debug('Error stating file', { path: fullPath, error: statError });
        continue;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Error reading directory with Node.js fs', { error: errorMessage, stack: errorStack, directory });
    throw error;
  }

  // Sort by name
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return files;
}

/**
 * List files in a directory
 * Uses fd if available, falls back to Node.js fs.readdir
 */
export async function listDirectory(
  directoryPath: string,
  settings?: Partial<FileSearchSettings>
): Promise<DirectoryInfo> {
  // Merge with default settings
  const defaultSettings: FileSearchSettings = {
    respectGitignore: true,
    excludePatterns: [],
    includePatterns: [],
    maxFiles: 5000,
    includeHidden: true,
    maxDepth: null,
    followSymlinks: false,
    fdPath: null
  };

  const mergedSettings: FileSearchSettings = {
    ...defaultSettings,
    ...settings
  };

  try {
    // Validate directory path
    if (!directoryPath || typeof directoryPath !== 'string') {
      return { error: 'Invalid directory path' };
    }

    // Sanitize path to prevent command injection
    const sanitizedPath = directoryPath
      .replace(/[;&|`$(){}[\]<>"'\\*?~^]/g, '')
      .replace(/\x00/g, '')
      .replace(/[\r\n]/g, '')
      .trim();

    if (sanitizedPath.length === 0) {
      return { error: 'Directory path is empty after sanitization' };
    }

    // Check if directory exists
    try {
      const stats = await stat(sanitizedPath);
      if (!stats.isDirectory()) {
        return { error: 'Path is not a directory', directory: sanitizedPath };
      }
    } catch (_statError) {
      return { error: 'Path does not exist', directory: sanitizedPath };
    }

    // Security: Disable file search for root directory
    if (sanitizedPath === '/') {
      return {
        success: true,
        directory: sanitizedPath,
        files: [],
        fileCount: 0,
        // searchMode is omitted when disabled (DirectoryInfo only allows 'recursive')
        partial: false
      };
    }

    // Try fd first
    const { fdAvailable, fdPath } = await checkFdAvailable();
    let files: FileInfo[];

    if (fdAvailable && fdPath) {
      try {
        files = await listFilesWithFd(sanitizedPath, fdPath, mergedSettings);
        const partial = files.length >= mergedSettings.maxFiles;

        return {
          success: true,
          directory: sanitizedPath,
          files,
          fileCount: files.length,
          searchMode: 'recursive' as const,  // Only set when actually recursive
          partial,
          fdAvailable: true
        };
      } catch (fdError) {
        const errorMessage = fdError instanceof Error ? fdError.message : String(fdError);
        logger.warn('fd failed, falling back to Node.js fs', { error: errorMessage, stack: fdError instanceof Error ? fdError.stack : undefined });
        files = await listFilesWithNodeFs(sanitizedPath, mergedSettings);
      }
    } else {
      logger.debug('fd not available, using Node.js fs fallback');
      files = await listFilesWithNodeFs(sanitizedPath, mergedSettings);
    }

    const partial = files.length >= mergedSettings.maxFiles;

    // Fallback mode: fd was either not available or failed
    return {
      success: true,
      directory: sanitizedPath,
      files,
      fileCount: files.length,
      partial,
      searchMode: 'recursive', // Always recursive in this implementation
      fdAvailable: fdAvailable
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Error listing directory', { error: errorMessage, stack: errorStack, directory: directoryPath });
    return {
      error: error instanceof Error ? error.message : 'Failed to list directory',
      directory: directoryPath
    };
  }
}
