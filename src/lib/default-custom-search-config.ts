import type { CustomSearchEntry } from '../types';
import { SUGGESTIONS } from '../constants';

/**
 * customSearch設定が未定義の場合のデフォルト設定を返す
 * 既存の commands.directories と agents.directories 設定と互換性のある動作を提供
 */
/** デフォルトの検索候補最大表示数 - 互換性のため再エクスポート */
export const DEFAULT_MAX_SUGGESTIONS = SUGGESTIONS.DEFAULT_MAX;

/** デフォルトのソート順（フィールド名 [asc|desc]） */
export const DEFAULT_ORDER_BY = 'name';

export function getDefaultCustomSearchConfig(): CustomSearchEntry[] {
  return [
    // NOTE: Built-in commands (Claude Code, etc.) are loaded from YAML files
    // via BuiltInCommandsLoader, not via customSearch. This keeps them separate
    // and allows YAML-based management.

    // User's custom slash commands
    {
      name: '{basename}',
      type: 'command',
      description: '{frontmatter@description}|{heading}',
      path: '~/.claude/commands',
      pattern: '*.md',
      argumentHint: '{frontmatter@argument-hint}',
      maxSuggestions: DEFAULT_MAX_SUGGESTIONS,
      orderBy: DEFAULT_ORDER_BY,
    },
    // User's custom agents
    {
      name: 'agent-{basename}',
      type: 'mention',
      description: '{frontmatter@description}|{heading}',
      path: '~/.claude/agents',
      pattern: '*.md',
      maxSuggestions: DEFAULT_MAX_SUGGESTIONS,
      orderBy: DEFAULT_ORDER_BY,
      // searchPrefix: 'agent', // Uncomment to require @agent: prefix for agent search
    },
  ];
}
