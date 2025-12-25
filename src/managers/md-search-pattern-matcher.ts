/**
 * Pattern matching utilities for MdSearchLoader
 */

/**
 * Parse pattern into structured components
 */
export function parsePattern(pattern: string): {
  isRecursive: boolean;
  intermediatePattern: string | null;
  filePattern: string;
} {
  const isRecursive = pattern.startsWith('**/');

  if (!isRecursive) {
    return {
      isRecursive: false,
      intermediatePattern: null,
      filePattern: pattern,
    };
  }

  const withoutPrefix = pattern.slice(3);
  const lastSlashIndex = withoutPrefix.lastIndexOf('/');

  if (lastSlashIndex === -1) {
    return {
      isRecursive: true,
      intermediatePattern: null,
      filePattern: withoutPrefix,
    };
  }

  const intermediatePattern = withoutPrefix.slice(0, lastSlashIndex);
  const filePattern = withoutPrefix.slice(lastSlashIndex + 1);

  return {
    isRecursive: true,
    intermediatePattern,
    filePattern,
  };
}

/**
 * Check if relative path suffix matches intermediate pattern
 */
export function matchesIntermediatePathSuffix(relativePath: string, intermediatePattern: string): boolean {
  const pathSegments = relativePath.split('/');
  const patternSegments = intermediatePattern.split('/');

  if (pathSegments.length < patternSegments.length) {
    return false;
  }

  const startIndex = pathSegments.length - patternSegments.length;

  for (let i = 0; i < patternSegments.length; i++) {
    const pathSeg = pathSegments[startIndex + i];
    const patternSeg = patternSegments[i];
    if (pathSeg === undefined || patternSeg === undefined) {
      return false;
    }
    if (!matchesGlobPattern(pathSeg, patternSeg)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if file matches pattern
 */
export function matchesFilePattern(
  fileName: string,
  relativePath: string,
  parsed: ReturnType<typeof parsePattern>
): boolean {
  if (!parsed.isRecursive) {
    return relativePath === fileName && matchesGlobPattern(fileName, parsed.filePattern);
  }

  if (parsed.intermediatePattern) {
    return false;
  }

  return matchesGlobPattern(fileName, parsed.filePattern);
}

/**
 * Check if name matches glob pattern
 */
export function matchesGlobPattern(name: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }

  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(name);
}

/**
 * Expand brace patterns
 */
export function expandBraces(pattern: string): string[] {
  const braceMatch = pattern.match(/\{([^}]+)\}/);
  if (!braceMatch || !braceMatch[1]) {
    return [pattern];
  }

  const fullMatch = braceMatch[0];
  const content = braceMatch[1];
  const alternatives = content.split(',').map(s => s.trim());
  const prefix = pattern.slice(0, braceMatch.index);
  const suffix = pattern.slice((braceMatch.index ?? 0) + fullMatch.length);

  const results: string[] = [];
  for (const alt of alternatives) {
    const expanded = prefix + alt + suffix;
    results.push(...expandBraces(expanded));
  }

  return results;
}
