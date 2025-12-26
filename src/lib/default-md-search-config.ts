import type { MdSearchEntry } from '../types';
import { SUGGESTIONS } from '../constants';

/**
 * mdSearch設定が未定義の場合のデフォルト設定を返す
 * 既存の commands.directories と agents.directories 設定と互換性のある動作を提供
 */
/** デフォルトの検索候補最大表示数 - 互換性のため再エクスポート */
export const DEFAULT_MAX_SUGGESTIONS = SUGGESTIONS.DEFAULT_MAX;

/** デフォルトのソート順 */
export const DEFAULT_SORT_ORDER: 'asc' | 'desc' = 'asc';

export function getDefaultMdSearchConfig(): MdSearchEntry[] {
  return [
    {
      name: '{basename}',
      type: 'command',
      description: '{frontmatter@description}',
      path: '~/.claude/commands',
      pattern: '*.md',
      argumentHint: '{frontmatter@argument-hint}',
      maxSuggestions: DEFAULT_MAX_SUGGESTIONS,
      sortOrder: DEFAULT_SORT_ORDER,
    },
    {
      name: 'agent-{basename}',
      type: 'mention',
      description: '{frontmatter@description}',
      path: '~/.claude/agents',
      pattern: '*.md',
      maxSuggestions: DEFAULT_MAX_SUGGESTIONS,
      sortOrder: DEFAULT_SORT_ORDER,
      // searchPrefix: 'agent:', // Uncomment to require @agent: prefix for agent search
    },
  ];
}
