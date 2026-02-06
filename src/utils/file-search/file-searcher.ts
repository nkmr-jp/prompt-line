/**
 * File Searcher - Cross-platform file search using fd or Node.js fallback
 * Replaces native Swift file-searcher binary
 */

import { execFile } from 'child_process';
import { readdir, stat, lstat, realpath } from 'fs/promises';
import { join, basename, resolve, normalize } from 'path';
import { logger } from '../logger';
import type { FileSearchSettings, FileInfo, DirectoryInfo } from '../../types';

// Restricted directories for security (prevent accidental enumeration of sensitive system directories)
const RESTRICTED_DIRECTORIES = [
  '/',
  '/System',
  '/Library',
  '/private',
  '/etc',
  '/var',
  '/usr',
  '/bin',
  '/sbin',
  '/boot',
  '/dev',
  '/proc',
  '/sys'
];

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
 * Sanitize path to prevent command injection and path traversal
 */
function sanitizePath(pathString: string): string {
  return pathString
    .replace(/[;&|`$(){}[\]<>"'\\*?~^]/g, '')
    .replace(/\x00/g, '')
    .replace(/[\r\n]/g, '')
    .trim();
}

/**
 * Check if a path is in a restricted directory
 */
function isRestrictedDirectory(pathString: string): boolean {
  const normalizedPath = normalize(pathString);
  return RESTRICTED_DIRECTORIES.some(restricted => {
    return normalizedPath === restricted || normalizedPath.startsWith(restricted + '/');
  });
}

/**
 * Validate and resolve path safely
 * Returns null if path is invalid, restricted, or doesn't exist
 */
// eslint-disable-next-line max-statements
async function validateAndResolvePath(pathString: string, basePath?: string): Promise<string | null> {
  try {
    // Sanitize first
    const sanitized = sanitizePath(pathString);
    if (!sanitized) return null;

    // Resolve to absolute path
    const absolutePath = basePath ? resolve(basePath, sanitized) : resolve(sanitized);

    // Check if restricted
    if (isRestrictedDirectory(absolutePath)) {
      logger.debug('Path is in restricted directory', { path: absolutePath });
      return null;
    }

    // Resolve symlinks to real path
    const realPath = await realpath(absolutePath);

    // Check again after resolving symlinks
    if (isRestrictedDirectory(realPath)) {
      logger.debug('Real path is in restricted directory', { path: realPath, original: absolutePath });
      return null;
    }

    // Verify it's a directory using lstat (doesn't follow symlinks)
    const stats = await lstat(absolutePath);
    if (!stats.isDirectory() && !stats.isSymbolicLink()) {
      return null;
    }

    // If it's a symlink, verify the target is a directory
    if (stats.isSymbolicLink()) {
      const targetStats = await stat(absolutePath);
      if (!targetStats.isDirectory()) {
        return null;
      }
    }

    return realPath;
  } catch (_error) {
    // Path doesn't exist or other error
    return null;
  }
}

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
  const allExcludes = [...DEFAULT_EXCLUDES, ...settings.excludePatterns];

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

    // eslint-disable-next-line max-statements
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
// eslint-disable-next-line max-statements
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
// eslint-disable-next-line max-lines-per-function, max-statements
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

    // Validate and resolve path (includes sanitization, symlink resolution, and restriction checks)
    const validatedPath = await validateAndResolvePath(directoryPath);
    if (!validatedPath) {
      return { error: 'Invalid, restricted, or non-existent directory path', directory: directoryPath };
    }

    const sanitizedPath = validatedPath;

    // Try fd first
    const { fdAvailable, fdPath } = await checkFdAvailable();
    let files: FileInfo[];

    if (fdAvailable && fdPath) {
      try {
        files = await listFilesWithFd(sanitizedPath, fdPath, mergedSettings);

        // Process includePatterns (like Swift implementation)
        // Search each includePattern separately with respectGitignore: false
        if (mergedSettings.includePatterns && mergedSettings.includePatterns.length > 0) {
          logger.debug('Processing includePatterns', {
            patterns: mergedSettings.includePatterns,
            directory: sanitizedPath
          });

          // eslint-disable-next-line max-depth
          for (const pattern of mergedSettings.includePatterns) {
            try {
              // Create settings for include pattern search
              const includeSettings: FileSearchSettings = {
                ...mergedSettings,
                respectGitignore: false,  // Ignore .gitignore for include patterns
                includeHidden: true,      // Allow hidden files in include patterns
                includePatterns: []       // Clear to avoid recursion
              };

              // Extract base directory from glob pattern (e.g., ".claude/**/*" -> ".claude")
              // fd's --glob flag doesn't match path components reliably for dot-directories,
              // so we extract the directory part and use it as the search path instead.
              const searchDir = pattern.replace(/\/\*\*.*$/, '').replace(/\/\*$/, '');

              // Sanitize the pattern-derived search directory
              const sanitizedSearchDir = sanitizePath(searchDir);
              if (!sanitizedSearchDir) {
                logger.debug('includePattern search directory is empty after sanitization, skipping', { pattern });
                continue;
              }

              // Check if searchDir is an absolute path
              const isAbsolute = sanitizedSearchDir.startsWith('/');

              // Validate and resolve the search path (includes restriction checks and symlink resolution)
              const validatedSearchPath = await validateAndResolvePath(
                sanitizedSearchDir,
                isAbsolute ? undefined : sanitizedPath
              );

              if (!validatedSearchPath) {
                logger.debug('includePattern search path is invalid, restricted, or does not exist, skipping', {
                  pattern,
                  searchDir: sanitizedSearchDir
                });
                continue;
              }

              // Build args with search directory instead of glob pattern
              const args: string[] = [
                '--type', 'f',
                '--color', 'never',
                '--absolute-path',
                '--no-ignore',           // Force ignore .gitignore
                '--no-ignore-vcs',       // Force ignore VCS ignore files
                '--hidden'               // Include hidden files
              ];

              // Add depth limit if specified
              if (includeSettings.maxDepth !== null && includeSettings.maxDepth !== undefined) {
                args.push('--max-depth', String(includeSettings.maxDepth));
              }

              // Add exclude patterns (DEFAULT_EXCLUDES + user excludes)
              const includeExcludes = [...DEFAULT_EXCLUDES, ...includeSettings.excludePatterns];
              for (const exclude of includeExcludes) {
                args.push('--exclude', exclude);
              }

              // fd syntax: fd [PATTERN] [PATH...]
              // Push pattern first
              args.push('.');  // Match all files

              // Use the validated path as cwd for fd
              const searchPath = validatedSearchPath;

              // Execute fd with include pattern
              const includeFiles = await new Promise<FileInfo[]>((resolve, _reject) => {
                execFile(fdPath, args, {
                  cwd: searchPath,
                  timeout: DEFAULT_TIMEOUT,
                  maxBuffer: DEFAULT_MAX_BUFFER,
                  killSignal: 'SIGTERM' as const
                }, (error, stdout, stderr) => {
                  if (error) {
                    logger.debug('includePattern search failed', { pattern, error: error.message });
                    resolve([]); // Empty result on error
                    return;
                  }

                  if (stderr) {
                    logger.debug('fd stderr for includePattern', { pattern, stderr });
                  }

                  const lines = stdout.split('\n').filter(line => line.trim());
                  const patternFiles: FileInfo[] = [];

                  for (const line of lines) {
                    const filePath = line.trim();
                    if (!filePath) continue;

                    patternFiles.push({
                      name: basename(filePath),
                      path: filePath,
                      isDirectory: false
                    });
                  }

                  resolve(patternFiles);
                });
              });

              logger.debug('includePattern search result', {
                pattern,
                foundFiles: includeFiles.length
              });

              // Merge results with maxFiles limit check
              const remaining = mergedSettings.maxFiles - files.length;
              if (remaining <= 0) {
                logger.debug('Reached maxFiles limit, skipping remaining includePatterns', {
                  maxFiles: mergedSettings.maxFiles,
                  currentCount: files.length
                });
                break;
              }

              // Only add files up to the remaining limit
              const filesToAdd = includeFiles.slice(0, remaining);
              files.push(...filesToAdd);
            } catch (patternError) {
              logger.warn('Error processing includePattern', {
                pattern,
                error: patternError instanceof Error ? patternError.message : String(patternError)
              });
            }
          }

          // Remove duplicates by path
          const uniquePaths = new Set<string>();
          files = files.filter(file => {
            if (uniquePaths.has(file.path)) {
              return false;
            }
            uniquePaths.add(file.path);
            return true;
          });

          logger.debug('Files after includePatterns merge', {
            totalFiles: files.length,
            uniqueFiles: uniquePaths.size
          });
        }

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
