import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import fg from 'fast-glob';

interface PrefixPatternParts {
  globPattern: string;
  fieldPath: string;
}

const prefixCache = new Map<string, string>();
const CACHE_MAX_SIZE = 100;

/**
 * パスの共通部分の長さを取得する
 */
function getCommonPathLength(path1: string, path2: string): number {
  const parts1 = path1.split(path.sep);
  const parts2 = path2.split(path.sep);
  let common = 0;
  for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
    if (parts1[i] === parts2[i]) common++;
    else break;
  }
  return common;
}

/**
 * 複数マッチがある場合、targetPathに最も近いものを選ぶ
 */
function findClosestMatch(matches: string[], targetPath: string): string | undefined {
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  return matches.reduce((closest, current) => {
    const closestCommon = getCommonPathLength(closest, targetPath);
    const currentCommon = getCommonPathLength(current, targetPath);
    return currentCommon > closestCommon ? current : closest;
  });
}

export function parsePrefixPattern(pattern: string): PrefixPatternParts | null {
  const atIndex = pattern.lastIndexOf('@');
  if (atIndex === -1) return null;
  return {
    globPattern: pattern.substring(0, atIndex),
    fieldPath: pattern.substring(atIndex + 1)
  };
}

export async function resolvePrefix(
  commandFilePath: string,
  prefixPattern: string,
  basePath: string
): Promise<string> {
  const parts = parsePrefixPattern(prefixPattern);
  if (!parts) return '';

  const commandDir = path.dirname(commandFilePath);
  const cacheKey = `${commandDir}:${prefixPattern}`;

  if (prefixCache.has(cacheKey)) {
    return prefixCache.get(cacheKey)!;
  }

  let searchDir = commandDir;
  const normalizedBasePath = path.normalize(basePath.replace(/^~/, os.homedir()));

  while (searchDir.startsWith(normalizedBasePath)) {
    const matches = await fg(parts.globPattern, {
      cwd: searchDir,
      absolute: true,
      onlyFiles: true
    });

    if (matches.length > 0) {
      const jsonPath = findClosestMatch(matches, commandFilePath);
      if (!jsonPath) continue;
      const prefix = extractFieldFromJson(jsonPath, parts.fieldPath);

      if (prefixCache.size >= CACHE_MAX_SIZE) {
        const firstKey = prefixCache.keys().next().value;
        if (firstKey) prefixCache.delete(firstKey);
      }
      prefixCache.set(cacheKey, prefix);
      return prefix;
    }

    const parentDir = path.dirname(searchDir);
    if (parentDir === searchDir) break;
    searchDir = parentDir;
  }

  prefixCache.set(cacheKey, '');
  return '';
}

function extractFieldFromJson(jsonPath: string, fieldPath: string): string {
  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const json = JSON.parse(content);
    const keys = fieldPath.split('.');
    let value: unknown = json;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return '';
      }
    }

    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export function clearPrefixCache(): void {
  prefixCache.clear();
}
