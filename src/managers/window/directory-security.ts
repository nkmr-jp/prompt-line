/**
 * Security checks for directory detection
 */

/**
 * Root-owned system directories that should have file search disabled
 */
const ROOT_OWNED_DIRECTORIES = [
  '/Library',
  '/System',
  '/Applications',
  '/bin',
  '/sbin',
  '/usr',
  '/var',
  '/etc',
  '/private',
  '/tmp',
  '/cores',
  '/opt'
];

/**
 * Check if a directory should have file search disabled
 * Root directory (/) and root-owned system directories are excluded for security
 * This is a pre-check before calling directory-detector; the Swift tool also checks ownership
 */
export function isFileSearchDisabledDirectory(directory: string): boolean {
  // Root directory
  if (directory === '/') return true;

  // Check if directory starts with any root-owned directory
  for (const rootDir of ROOT_OWNED_DIRECTORIES) {
    if (directory === rootDir || directory.startsWith(rootDir + '/')) {
      return true;
    }
  }

  return false;
}
