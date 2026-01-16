/**
 * Real data loader for scoring tests
 * Loads actual user data from ~/.prompt-line for realistic testing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';

// === Interfaces ===

export interface HistoryEntry {
  text: string;
  timestamp: number;
  id: string;
  appName?: string;
  directory?: string;
}

export interface FileUsageEntry {
  key: string;
  count: number;
  lastUsed: number;
  firstUsed: number;
}

export interface SlashCommandUsageEntry {
  name: string;
  count: number;
  lastUsed: number;
  firstUsed: number;
}

export interface AgentUsageEntry {
  key: string;
  count: number;
  lastUsed: number;
  firstUsed: number;
}

export interface RealTestData {
  history: HistoryEntry[];
  fileUsage: FileUsageEntry[];
  slashCommands: SlashCommandUsageEntry[];
  agents: AgentUsageEntry[];
}

export interface HistoryStats {
  total: number;
  last24h: number;
  last7d: number;
  last30d: number;
  avgTextLength: number;
  byApp: Record<string, number>;
}

// === File Paths ===

const PROMPT_LINE_DIR = path.join(os.homedir(), '.prompt-line');
const HISTORY_FILE = path.join(PROMPT_LINE_DIR, 'history.jsonl');
const CACHE_DIR = path.join(PROMPT_LINE_DIR, 'cache', 'projects');
const FILE_USAGE_FILE = path.join(CACHE_DIR, 'file-usage-history.jsonl');
const SLASH_COMMANDS_FILE = path.join(CACHE_DIR, 'global-slash-commands.jsonl');
const AGENT_USAGE_FILE = path.join(CACHE_DIR, 'agent-usage-history.jsonl');

// === Core Functions ===

/**
 * Load JSONL file asynchronously
 * @param filePath Path to the JSONL file
 * @returns Array of parsed entries
 */
export async function loadJsonl<T>(filePath: string): Promise<T[]> {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const results: T[] = [];
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed) as T;
      results.push(parsed);
    } catch {
      // Skip invalid JSON lines
    }
  }

  return results;
}

/**
 * Load all real test data from ~/.prompt-line
 * @returns RealTestData containing history, file usage, slash commands, and agents
 */
export async function loadRealTestData(): Promise<RealTestData> {
  const [history, fileUsage, slashCommands, agents] = await Promise.all([
    loadJsonl<HistoryEntry>(HISTORY_FILE),
    loadJsonl<FileUsageEntry>(FILE_USAGE_FILE),
    loadJsonl<SlashCommandUsageEntry>(SLASH_COMMANDS_FILE),
    loadJsonl<AgentUsageEntry>(AGENT_USAGE_FILE),
  ]);

  return {
    history,
    fileUsage,
    slashCommands,
    agents,
  };
}

/**
 * Calculate history statistics
 * @param history Array of history entries
 * @returns HistoryStats with various metrics
 */
export function getHistoryStats(history: HistoryEntry[]): HistoryStats {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const stats: HistoryStats = {
    total: history.length,
    last24h: 0,
    last7d: 0,
    last30d: 0,
    avgTextLength: 0,
    byApp: {},
  };

  if (history.length === 0) {
    return stats;
  }

  let totalLength = 0;

  for (const entry of history) {
    const age = now - entry.timestamp;

    if (age <= day) {
      stats.last24h++;
    }
    if (age <= 7 * day) {
      stats.last7d++;
    }
    if (age <= 30 * day) {
      stats.last30d++;
    }

    totalLength += entry.text.length;

    const appName = entry.appName ?? 'unknown';
    stats.byApp[appName] = (stats.byApp[appName] ?? 0) + 1;
  }

  stats.avgTextLength = Math.round(totalLength / history.length);

  return stats;
}
