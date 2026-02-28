/**
 * TemplateResolver - テンプレート変数を解決するユーティリティ
 *
 * サポートする変数:
 * - {prefix}: プレフィックス文字列
 * - {basename}: ファイル名（拡張子なし）
 * - {dirname}: 親ディレクトリ名
 * - {dirname:N}: N階層上のディレクトリ名（例: {dirname:2} = 2つ上）
 * - {frontmatter@fieldName}: frontmatterの任意フィールド
 * - {heading}: 最初の # heading のテキスト
 * - {json@path}: JSONデータの値参照（ドット記法・配列インデックス対応）
 * - {json:N@path}: 親要素のJSONデータ参照（N=1: 直接の親、N=2: 2つ上の親）
 * - {content}: ファイルの全コンテンツ
 * - {filepath}: ファイルの絶対パス
 *
 * フォールバック構文:
 * - テンプレート全体で `|` を使うと、左側が空文字の場合に右側にフォールバック
 * - 例: "{frontmatter@description}|{heading}" → frontmatterが空なら最初のheadingを使用
 */

export interface TemplateContext {
  prefix?: string;
  basename: string;
  dirname?: string;
  filePath?: string;
  frontmatter: Record<string, string>;
  heading?: string;
  line?: string;
  content?: string;
  jsonData?: Record<string, unknown>;
  parentJsonDataStack?: Record<string, unknown>[];
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
  // フォールバック構文: "templateA|templateB" → templateAが空ならtemplateBを使用
  const pipeIndex = template.indexOf('|');
  if (pipeIndex !== -1) {
    const primary = template.slice(0, pipeIndex);
    const fallback = template.slice(pipeIndex + 1);
    const primaryResult = resolveTemplate(primary, context);
    return primaryResult || resolveTemplate(fallback, context);
  }

  let result = template;

  // Replace {prefix}
  if (context.prefix !== undefined) {
    result = result.replace(/\{prefix\}/g, context.prefix);
  }

  // Replace {basename}
  result = result.replace(/\{basename\}/g, context.basename);

  // Replace {dirname} and {dirname:N}
  if (context.filePath) {
    result = result.replace(/\{dirname:(\d+)\}/g, (_, level: string) => {
      return getDirname(context.filePath!, parseInt(level, 10));
    });
  }
  if (context.dirname !== undefined) {
    result = result.replace(/\{dirname\}/g, context.dirname);
  }

  // Replace {heading}
  result = result.replace(/\{heading\}/g, context.heading ?? '');

  // Replace {line}
  result = result.replace(/\{line\}/g, context.line ?? '');

  // Replace {content}
  result = result.replace(/\{content\}/g, context.content ?? '');

  // Replace {filepath}
  result = result.replace(/\{filepath\}/g, context.filePath ?? '');

  // Replace {frontmatter@fieldName}
  result = result.replace(/\{frontmatter@([^}]+)\}/g, (_, fieldName: string) => {
    return context.frontmatter[fieldName] ?? '';
  });

  // Replace {json:N@path} (parent JSON data reference)
  if (context.parentJsonDataStack) {
    result = result.replace(/\{json:(\d+)@([^}]+)\}/g, (_, level: string, jsonPath: string) => {
      const index = parseInt(level, 10) - 1; // N=1 → index 0 (direct parent)
      const stack = context.parentJsonDataStack!;
      if (index < 0 || index >= stack.length) return '';
      return resolveJsonPath(stack[index]!, jsonPath);
    });
  }

  // Replace {json@path}
  if (context.jsonData) {
    result = result.replace(/\{json@([^}]+)\}/g, (_, jsonPath: string) => {
      return resolveJsonPath(context.jsonData!, jsonPath);
    });
  }

  return result;
}

/**
 * ファイルの親ディレクトリ名を取得
 * @param level 階層数（1=親、2=2つ上、デフォルト: 1）
 */
export function getDirname(filePath: string, level: number = 1): string {
  const parts = filePath.split('/');
  const index = parts.length - 1 - level;
  return index >= 0 ? parts[index] ?? '' : '';
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
 * Markdownファイルの内容から最初の # heading を取得
 * frontmatter部分をスキップして、最初の `# ` で始まる行を返す
 */
export function parseFirstHeading(content: string): string {
  // frontmatter部分をスキップ
  let body = content;
  const frontmatterMatch = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?/);
  if (frontmatterMatch) {
    body = content.slice(frontmatterMatch[0].length);
  }

  // 最初の # heading を検索
  const headingMatch = body.match(/^# (.+)$/m);
  return headingMatch?.[1]?.trim() ?? '';
}

/**
 * JSON文字列をパースしてオブジェクトを返す
 * パース失敗またはオブジェクトでない場合はnullを返す
 */
export function parseJsonContent(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * JSONデータからパスを辿って値を取得する
 * - ドット記法: `items.name` -> data.items.name
 * - 配列インデックス: `items[0]` -> 最初の要素, `items[-1]` -> 最後の要素
 * - 値が見つからない場合は空文字を返す
 * - 値がobject/arrayの場合はJSON.stringifyして返す
 */
export function resolveJsonPath(data: Record<string, unknown>, path: string): string {
  // パスをトークンに分割: "items[0].name" -> ["items", "[0]", "name"]
  const tokens = path.split(/\.|\[/).reduce<string[]>((acc, part) => {
    if (part === '') return acc;
    if (part.endsWith(']')) {
      acc.push('[' + part);
    } else {
      acc.push(part);
    }
    return acc;
  }, []);

  let current: unknown = data;

  for (const token of tokens) {
    if (current === null || current === undefined) {
      return '';
    }

    const indexMatch = token.match(/^\[(-?\d+)\]$/);
    if (indexMatch) {
      // 配列インデックスアクセス
      if (!Array.isArray(current)) {
        return '';
      }
      const index = parseInt(indexMatch[1]!, 10);
      current = index < 0 ? current[current.length + index] : current[index];
    } else {
      // オブジェクトキーアクセス
      if (typeof current !== 'object' || Array.isArray(current)) {
        return '';
      }
      current = (current as Record<string, unknown>)[token];
    }
  }

  if (current === null || current === undefined) {
    return '';
  }

  if (typeof current === 'object') {
    return JSON.stringify(current);
  }

  return String(current);
}

/**
 * frontmatterの生テキストを取得
 */
export function extractRawFrontmatter(content: string): string {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  return frontmatterMatch?.[1]?.trim() ?? '';
}
