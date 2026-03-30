/**
 * TemplateResolver - テンプレート変数を解決するユーティリティ
 *
 * サポートする変数:
 * - {<key>}: valuesマップで定義された任意のテンプレート変数（例: {prefix}）
 * - {basename}: ファイル名（拡張子なし）
 * - {dirname}: 親ディレクトリ名
 * - {dirname:N}: N階層上のディレクトリ名（例: {dirname:2} = 2つ上）
 * - {pathdir:N}: pathから下にN番目のディレクトリ名（例: path/a/b/file.md → {pathdir:1} = a）
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
  /** @deprecated Use values instead */
  prefix?: string;
  /** valuesマップで定義された任意のテンプレート変数（キー名が {key} として解決される） */
  values?: Record<string, string>;
  basename: string;
  dirname?: string;
  filePath?: string;
  basePath?: string;
  frontmatter: Record<string, string>;
  heading?: string;
  line?: string;
  content?: string;
  jsonData?: Record<string, unknown>;
  parentJsonDataStack?: Record<string, unknown>[];
}

/**
 * テンプレート変数を解決する
 * @param template - テンプレート文字列
 * @param context - 変数値を持つコンテキスト
 * @param valueTransform - 解決された各変数値に適用する変換関数（例: shellQuote）
 * @example
 * resolve("{basename}", { basename: "my-command", frontmatter: {} })
 * // => "my-command"
 *
 * resolve("agent-{frontmatter@name}", { basename: "agent", frontmatter: { name: "helper" } })
 * // => "agent-helper"
 */
export function resolveTemplate(
  template: string,
  context: TemplateContext,
  valueTransform?: (value: string) => string,
): string {
  const t = valueTransform ?? ((v: string) => v);

  // フォールバック構文: "templateA|templateB" → templateAが空ならtemplateBを使用
  const pipeIndex = template.indexOf('|');
  if (pipeIndex !== -1) {
    const primary = template.slice(0, pipeIndex);
    const fallback = template.slice(pipeIndex + 1);
    const primaryResult = resolveTemplate(primary, context, valueTransform);
    return primaryResult || resolveTemplate(fallback, context, valueTransform);
  }

  let result = template;

  // Replace values-defined template variables (e.g., {prefix}, {custom_key}, etc.)
  if (context.values) {
    for (const [key, value] of Object.entries(context.values)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), t(value));
    }
  }

  // Backward compatibility: Replace {prefix} from legacy context.prefix
  if (context.prefix !== undefined && !context.values?.prefix) {
    result = result.replace(/\{prefix\}/g, t(context.prefix));
  }

  // Replace {basename}
  result = result.replace(/\{basename\}/g, t(context.basename));

  // Replace {dirname} and {dirname:N}
  if (context.filePath) {
    result = result.replace(/\{dirname:(\d+)\}/g, (_, level: string) => {
      return t(getDirname(context.filePath!, parseInt(level, 10)));
    });
  }
  if (context.dirname !== undefined) {
    result = result.replace(/\{dirname\}/g, t(context.dirname));
  }

  // Replace {pathdir:N} — N-th directory segment counting down from basePath
  if (context.filePath && context.basePath) {
    result = result.replace(/\{pathdir:(\d+)\}/g, (_, level: string) => {
      return t(getPathdir(context.filePath!, context.basePath!, parseInt(level, 10)));
    });
  }

  // Replace {heading}
  result = result.replace(/\{heading\}/g, t(context.heading ?? ''));

  // Replace {line}
  result = result.replace(/\{line\}/g, t(context.line ?? ''));

  // Replace {content}
  if (context.content !== undefined) {
    result = result.replace(/\{content\}/g, t(context.content));
  }

  // Replace {filepath}
  if (context.filePath) {
    result = result.replace(/\{filepath\}/g, t(context.filePath));
  }

  // Replace {frontmatter@fieldName}
  result = result.replace(/\{frontmatter@([^}]+)\}/g, (_, fieldName: string) => {
    return t(context.frontmatter[fieldName] ?? '');
  });

  // Replace {json:N@path} (parent JSON data reference)
  if (context.parentJsonDataStack) {
    result = result.replace(/\{json:(\d+)@([^}]+)\}/g, (_, level: string, jsonPath: string) => {
      const index = parseInt(level, 10) - 1; // N=1 → index 0 (direct parent)
      const stack = context.parentJsonDataStack!;
      if (index < 0 || index >= stack.length) return '';
      return t(resolveJsonPath(stack[index]!, jsonPath));
    });
  }

  // Replace {json@path}
  if (context.jsonData) {
    result = result.replace(/\{json@([^}]+)\}/g, (_, jsonPath: string) => {
      return t(resolveJsonPath(context.jsonData!, jsonPath));
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
 * basePath からの相対パスでN番目のディレクトリ名を取得
 * @param level N番目（1=basePath直下の最初のディレクトリ）
 * @example getPathdir('/a/b/c/d/file.md', '/a/b', 1) → 'c'
 * @example getPathdir('/a/b/c/d/file.md', '/a/b', 2) → 'd'
 */
export function getPathdir(filePath: string, basePath: string, level: number): string {
  const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
  if (!filePath.startsWith(normalizedBase)) return '';
  const relative = filePath.slice(normalizedBase.length);
  const parts = relative.split('/');
  // parts: ['c', 'd', 'file.md'] — last element is the file, so directories are 0..length-2
  const index = level - 1;
  return (index >= 0 && index < parts.length - 1) ? parts[index] ?? '' : '';
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

  const raw = frontmatterMatch[1];

  // Try js-yaml first for proper block scalar support (>-, |, etc.)
  try {
    const yaml = require('js-yaml');
    const parsed = yaml.load(raw);
    if (parsed && typeof parsed === 'object') {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (value !== null && value !== undefined) {
          result[key] = String(value).replace(/\n+/g, ' ').trim();
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
  } catch { /* fall through to regex parser */ }

  // Fallback: simple line-by-line parser for non-standard YAML
  const result: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (match?.[1] && match[2]) {
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[match[1]] = value.replace(/\n+/g, ' ').trim();
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
