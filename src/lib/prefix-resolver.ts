import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import { glob } from 'glob';

interface PrefixPatternParts {
  globPattern: string;
  fieldPath: string;
}

const prefixCache = new Map<string, string>();
const CACHE_MAX_SIZE = 100;

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
    const matches = await glob(parts.globPattern, {
      cwd: searchDir,
      absolute: true,
      nodir: true
    });

    if (matches.length > 0) {
      const jsonPath = matches[0];
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
