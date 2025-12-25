/**
 * Entry loading utilities for MdSearchLoader
 * Handles loading and parsing of markdown entries
 */

import { promises as fs } from 'fs';
import os from 'os';
import { logger } from '../utils/utils';
import type { MdSearchEntry, MdSearchItem } from '../types';
import {
  resolveTemplate,
  getBasename,
  parseFrontmatter,
  extractRawFrontmatter,
  type TemplateContext,
} from '../lib/template-resolver';
import { findFiles } from './md-search-file-finder';

/**
 * Validate and expand directory path
 */
export async function validateDirectory(entryPath: string): Promise<string | null> {
  const expandedPath = entryPath.replace(/^~/, os.homedir());

  try {
    const stats = await fs.stat(expandedPath);
    if (!stats.isDirectory()) {
      logger.warn('MdSearch path is not a directory', { path: expandedPath });
      return null;
    }
    return expandedPath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.debug('MdSearch directory does not exist', { path: expandedPath });
      return null;
    }
    throw error;
  }
}

/**
 * Create template context from file content
 */
function createTemplateContext(filePath: string, content: string): TemplateContext {
  const frontmatter = parseFrontmatter(content);
  const basename = getBasename(filePath);
  return { basename, frontmatter };
}

/**
 * Create base item from entry and context
 */
function createBaseItem(
  entry: MdSearchEntry,
  filePath: string,
  sourceId: string,
  context: TemplateContext
): MdSearchItem {
  return {
    name: resolveTemplate(entry.name, context),
    description: resolveTemplate(entry.description, context),
    type: entry.type,
    filePath,
    sourceId,
  };
}

/**
 * Add optional fields to item
 */
function addOptionalFields(
  item: MdSearchItem,
  entry: MdSearchEntry,
  rawFrontmatter: string | null,
  context: TemplateContext
): void {
  if (rawFrontmatter) {
    item.frontmatter = rawFrontmatter;
  }

  if (entry.argumentHint) {
    const resolvedHint = resolveTemplate(entry.argumentHint, context);
    if (resolvedHint) {
      item.argumentHint = resolvedHint;
    }
  }

  if (entry.inputFormat) {
    item.inputFormat = entry.inputFormat;
  }
}

/**
 * Load a single markdown file and create an item
 */
export async function loadMarkdownFile(
  filePath: string,
  entry: MdSearchEntry,
  sourceId: string
): Promise<MdSearchItem | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const context = createTemplateContext(filePath, content);
    const rawFrontmatter = extractRawFrontmatter(content);

    const item = createBaseItem(entry, filePath, sourceId, context);
    addOptionalFields(item, entry, rawFrontmatter, context);

    return item;
  } catch (error) {
    logger.warn('Failed to parse file', { filePath, error });
    return null;
  }
}

/**
 * Load all items from a single entry
 */
export async function loadEntry(entry: MdSearchEntry): Promise<MdSearchItem[]> {
  const expandedPath = await validateDirectory(entry.path);
  if (!expandedPath) {
    return [];
  }

  const files = await findFiles(expandedPath, entry.pattern);
  const items: MdSearchItem[] = [];
  const sourceId = `${entry.path}:${entry.pattern}`;

  for (const filePath of files) {
    const item = await loadMarkdownFile(filePath, entry, sourceId);
    if (item) {
      items.push(item);
    }
  }

  logger.debug('MdSearch entry loaded', { sourceId, count: items.length });
  return items;
}
