import type { FileSearchSettings } from '../../types';

/**
 * Build file searcher arguments from settings
 * Converts FileSearchSettings into command-line arguments
 */
export function buildFileSearcherArgs(
  directory: string,
  settings: FileSearchSettings | null
): string[] {
  const args: string[] = ['list', directory];

  if (!settings) {
    return args;
  }

  appendGitignoreFlag(args, settings);
  appendExcludePatterns(args, settings);
  appendIncludePatterns(args, settings);
  appendMaxFiles(args, settings);
  appendIncludeHidden(args, settings);
  appendMaxDepth(args, settings);
  appendFollowSymlinks(args, settings);

  return args;
}

/**
 * Append gitignore flag
 */
function appendGitignoreFlag(args: string[], settings: FileSearchSettings): void {
  if (!settings.respectGitignore) {
    args.push('--no-gitignore');
  }
}

/**
 * Append exclude patterns
 */
function appendExcludePatterns(args: string[], settings: FileSearchSettings): void {
  if (settings.excludePatterns?.length) {
    for (const pattern of settings.excludePatterns) {
      args.push('--exclude', pattern);
    }
  }
}

/**
 * Append include patterns
 */
function appendIncludePatterns(args: string[], settings: FileSearchSettings): void {
  if (settings.includePatterns?.length) {
    for (const pattern of settings.includePatterns) {
      args.push('--include', pattern);
    }
  }
}

/**
 * Append max files limit
 */
function appendMaxFiles(args: string[], settings: FileSearchSettings): void {
  if (settings.maxFiles) {
    args.push('--max-files', String(settings.maxFiles));
  }
}

/**
 * Append include hidden flag
 */
function appendIncludeHidden(args: string[], settings: FileSearchSettings): void {
  if (settings.includeHidden) {
    args.push('--include-hidden');
  }
}

/**
 * Append max depth setting
 */
function appendMaxDepth(args: string[], settings: FileSearchSettings): void {
  if (settings.maxDepth !== null && settings.maxDepth !== undefined) {
    args.push('--max-depth', String(settings.maxDepth));
  }
}

/**
 * Append follow symlinks flag
 */
function appendFollowSymlinks(args: string[], settings: FileSearchSettings): void {
  if (settings.followSymlinks) {
    args.push('--follow-symlinks');
  }
}
