/**
 * 入力フォーマットの種類
 * - name: 名前のみを挿入（例: "config.ts"）
 * - path: パスを挿入（例: "src/config.ts"）
 */
export type InputFormatType = 'name' | 'path';

/**
 * mdSearch エントリの種類
 * - command: スラッシュコマンド（/で始まる）
 * - mention: メンション（@で始まる）
 */
export type MdSearchType = 'command' | 'mention';

/**
 * mdSearch 設定エントリ
 */
export interface MdSearchEntry {
  /** 名前テンプレート（例: "{basename}", "agent-{frontmatter@name}"） */
  name: string;
  /** 検索タイプ */
  type: MdSearchType;
  /** 説明テンプレート（例: "{frontmatter@description}"） */
  description: string;
  /** 検索ディレクトリパス */
  path: string;
  /** ファイルパターン（glob形式、例: "*.md", "SKILL.md"） */
  pattern: string;
  /** オプション: argumentHintテンプレート */
  argumentHint?: string;
  /** オプション: 検索候補の最大表示数（デフォルト: 20） */
  maxSuggestions?: number;
  /** オプション: 検索プレフィックス（例: "agent:"）- このプレフィックスで始まるクエリのみ検索対象 */
  searchPrefix?: string;
  /** オプション: 名前ソート順（デフォルト: 'asc'） - 'asc': 昇順, 'desc': 降順 */
  sortOrder?: 'asc' | 'desc';
  /** オプション: 入力フォーマット（デフォルト: 'name'） - 'name': 名前のみ, 'path': ファイルパス */
  inputFormat?: InputFormatType;
}

/**
 * 検索結果アイテム（統一型）
 */
export interface MdSearchItem {
  /** 解決済み名前 */
  name: string;
  /** 解決済み説明 */
  description: string;
  /** ソースタイプ */
  type: MdSearchType;
  /** ファイルパス */
  filePath: string;
  /** 元のfrontmatter文字列 */
  frontmatter?: string;
  /** argumentHint（commandタイプのみ） */
  argumentHint?: string;
  /** 検索ソースの識別子（path + pattern） */
  sourceId: string;
  /** 入力フォーマット（'name' | 'path'） */
  inputFormat?: InputFormatType;
}

export interface SlashCommandItem {
  name: string;
  description: string;
  argumentHint?: string; // Hint text shown when editing arguments (after Tab selection)
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
  inputFormat?: InputFormatType;  // 入力フォーマット（'name' | 'path'）
}

export interface AgentItem {
  name: string;
  description: string;
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
  inputFormat?: InputFormatType;  // 入力フォーマット（'name' | 'path'）
}
