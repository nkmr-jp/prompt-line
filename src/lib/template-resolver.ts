/**
 * TemplateResolver - テンプレート変数を解決するユーティリティ
 *
 * サポートする変数:
 * - {prefix}: プレフィックス文字列
 * - {basename}: ファイル名（拡張子なし）
 * - {dirname}: 親ディレクトリ名
 * - {frontmatter@fieldName}: frontmatterの任意フィールド
 */

export interface TemplateContext {
  prefix?: string;
  basename: string;
  dirname?: string;
  frontmatter: Record<string, string>;
}

/**
 * テンプレート変数を解決する
 * @example
 * resolve("{basename}", { basename: "my-command", frontmatter: {} })
 * // => "my-command"
 *
 * resolve("agent-{frontmatter@name}", { basename: "agent", frontmatter: { name: "helper" } })
 * // => "agent-helper"
 */
export function resolveTemplate(template: string, context: TemplateContext): string {
  let result = template;

  // Replace {prefix}
  if (context.prefix !== undefined) {
    result = result.replace(/\{prefix\}/g, context.prefix);
  }

  // Replace {basename}
  result = result.replace(/\{basename\}/g, context.basename);

  // Replace {dirname}
  if (context.dirname !== undefined) {
    result = result.replace(/\{dirname\}/g, context.dirname);
  }

  // Replace {frontmatter@fieldName}
  result = result.replace(/\{frontmatter@([^}]+)\}/g, (_, fieldName: string) => {
    return context.frontmatter[fieldName] ?? '';
  });

  return result;
}

/**
 * ファイルの親ディレクトリ名を取得
 */
export function getDirname(filePath: string): string {
  const parts = filePath.split('/');
  return parts.length >= 2 ? parts[parts.length - 2] ?? '' : '';
}

/**
 * ファイルのbasenameを取得（拡張子を除く）
 */
export function getBasename(filePath: string): string {
  const fileName = filePath.split('/').pop() ?? '';
  return fileName.replace(/\.[^.]+$/, '');
}

/**
 * Markdownファイルの内容からfrontmatterを解析
 * @returns frontmatterのkey-valueペア
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch?.[1]) {
    return {};
  }

  const frontmatter = frontmatterMatch[1];
  const result: Record<string, string> = {};

  // 各行を解析
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (match?.[1] && match[2]) {
      let value = match[2].trim();
      // クォートを除去
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[match[1]] = value;
    }
  }

  return result;
}

/**
 * frontmatterの生テキストを取得
 */
export function extractRawFrontmatter(content: string): string {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  return frontmatterMatch?.[1]?.trim() ?? '';
}
