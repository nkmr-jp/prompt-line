import type { MdSearchEntry } from '../types';

/**
 * mdSearch設定が未定義の場合のデフォルト設定を返す
 * 既存の commands.directories と agents.directories 設定と互換性のある動作を提供
 */
/** デフォルトの検索候補最大表示数 */
export const DEFAULT_MAX_SUGGESTIONS = 20;

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
    },
    {
      name: 'agent-{basename}',
      type: 'mention',
      description: '{frontmatter@description}',
      path: '~/.claude/agents',
      pattern: '*.md',
      maxSuggestions: DEFAULT_MAX_SUGGESTIONS,
      searchPrefix: 'agent:',
    },
  ];
}
