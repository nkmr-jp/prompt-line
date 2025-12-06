import type { MdSearchEntry } from '../types';

/**
 * mdSearch設定が未定義の場合のデフォルト設定を返す
 * 既存の commands.directories と agents.directories 設定と互換性のある動作を提供
 */
export function getDefaultMdSearchConfig(): MdSearchEntry[] {
  return [
    {
      name: '{basename}',
      type: 'command',
      description: '{frontmatter@description}',
      path: '~/.claude/commands',
      pattern: '*.md',
      argumentHint: '{frontmatter@argument-hint}',
    },
    {
      name: '{basename}',
      type: 'mention',
      description: '{frontmatter@description}',
      path: '~/.claude/agents',
      pattern: '*.md',
    },
  ];
}
