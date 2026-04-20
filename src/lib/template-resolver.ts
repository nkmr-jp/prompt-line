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
 * - {args.key}: テンプレート引数（例: args: { open: "iTerm" } → {args.open} = "iTerm"）
 * - {content}: ファイルの全コンテンツ
 * - {filepath}: ファイルの絶対パス
 * - {projectdir}: 現在のプロジェクトディレクトリ（DirectoryManagerのCWD）
 *
 * フォールバック構文:
 * - テンプレート全体で `|` を使うと、左側が空文字の場合に右側にフォールバック
 * - 例: "{frontmatter@description}|{heading}" → frontmatterが空なら最初のheadingを使用
 *
 * パフォーマンス:
 * - 同じテンプレート文字列に対する解析結果をプロセス内でキャッシュ（LRUなし、YAML由来で有界）
 * - {json@...} のパストークナイズ結果も別キャッシュで再利用
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
  /** テンプレート引数（{args.key} として解決される） */
  args?: Record<string, string>;
  /** 現在のプロジェクトディレクトリ（{projectdir} として解決される） */
  projectdir?: string;
}

type ValueTransform = (v: string) => string;

/** Compiled op kinds. The discriminator `k` is numeric for fast switch dispatch. */
const enum OpKind {
  LIT = 0,
  VAR = 1,
  DIRNAME_N = 2,
  PATHDIR = 3,
  FRONTMATTER = 4,
  ARGS = 5,
  JSON = 6,
  JSON_PARENT = 7,
}

type Op =
  | { k: OpKind.LIT; v: string }
  | { k: OpKind.VAR; name: string; raw: string }
  | { k: OpKind.DIRNAME_N; level: number; raw: string }
  | { k: OpKind.PATHDIR; level: number; raw: string }
  | { k: OpKind.FRONTMATTER; field: string; raw: string }
  | { k: OpKind.ARGS; key: string; raw: string }
  | { k: OpKind.JSON; tokens: string[]; pathRaw: string; raw: string }
  | { k: OpKind.JSON_PARENT; level: number; tokens: string[]; pathRaw: string; raw: string };

type Segment = Op[];
interface Compiled {
  segments: Segment[];
}

// Module-level caches. Templates are user-authored (YAML) so the set of distinct
// strings is bounded; the size caps below are a safety net for any caller that
// feeds dynamic strings through.
const templateCache = new Map<string, Compiled>();
const jsonPathTokenCache = new Map<string, string[]>();
const TEMPLATE_CACHE_MAX = 500;
const JSON_PATH_CACHE_MAX = 1000;

// Custom-search hot paths resolve 10+ templates against the same row's jsonData;
// if a terminal lands on a large object, we would re-stringify it per call.
// Memoize by object identity so the string is shared; GC reclaims with the row.
// Safe because templates only read jsonData — callers must not mutate a cached
// object and expect the serialized form to update.
const stringifyCache = new WeakMap<object, string>();

const INDEX_TOKEN_RE = /^\[(-?\d+)\]$/;

/** Parse a JSON path like "items[0].name" into tokens like ["items", "[0]", "name"]. */
function tokenizeJsonPath(path: string): string[] {
  let tokens = jsonPathTokenCache.get(path);
  if (tokens) return tokens;
  if (jsonPathTokenCache.size >= JSON_PATH_CACHE_MAX) jsonPathTokenCache.clear();
  tokens = path.split(/\.|\[/).reduce<string[]>((acc, part) => {
    if (part === '') return acc;
    acc.push(part.endsWith(']') ? '[' + part : part);
    return acc;
  }, []);
  jsonPathTokenCache.set(path, tokens);
  return tokens;
}

/** Parse a single `{...}` token's inner content into an op. */
function parseToken(raw: string): Op {
  // {dirname:N}
  const dirMatch = /^dirname:(\d+)$/.exec(raw);
  if (dirMatch) return { k: OpKind.DIRNAME_N, level: parseInt(dirMatch[1]!, 10), raw };

  // {pathdir:N}
  const pathMatch = /^pathdir:(\d+)$/.exec(raw);
  if (pathMatch) return { k: OpKind.PATHDIR, level: parseInt(pathMatch[1]!, 10), raw };

  // {frontmatter@field} (requires at least one char after @, matching original regex `[^}]+`)
  if (raw.startsWith('frontmatter@') && raw.length > 'frontmatter@'.length) {
    return { k: OpKind.FRONTMATTER, field: raw.slice('frontmatter@'.length), raw };
  }

  // {args.key}
  if (raw.startsWith('args.') && raw.length > 'args.'.length) {
    return { k: OpKind.ARGS, key: raw.slice('args.'.length), raw };
  }

  // {json:N@path}
  const jpMatch = /^json:(\d+)@(.+)$/.exec(raw);
  if (jpMatch) {
    const pathRaw = jpMatch[2]!;
    return {
      k: OpKind.JSON_PARENT,
      level: parseInt(jpMatch[1]!, 10),
      tokens: tokenizeJsonPath(pathRaw),
      pathRaw,
      raw,
    };
  }

  // {json@path}
  if (raw.startsWith('json@') && raw.length > 'json@'.length) {
    const pathRaw = raw.slice('json@'.length);
    return {
      k: OpKind.JSON,
      tokens: tokenizeJsonPath(pathRaw),
      pathRaw,
      raw,
    };
  }

  // Bare {name}. Unknown names fall back to literal at runtime (see runVar).
  return { k: OpKind.VAR, name: raw, raw };
}

/** Scan a pipe-free segment into a list of ops (literals + tokens). */
function compileSegment(segmentText: string): Segment {
  const ops: Segment = [];
  const re = /\{([^}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(segmentText)) !== null) {
    if (m.index > last) {
      ops.push({ k: OpKind.LIT, v: segmentText.slice(last, m.index) });
    }
    ops.push(parseToken(m[1]!));
    last = m.index + m[0].length;
  }
  if (last < segmentText.length) {
    ops.push({ k: OpKind.LIT, v: segmentText.slice(last) });
  }
  return ops;
}

/** Compile a full template string (top-level `|` split into fallback segments). */
function compile(template: string): Compiled {
  let cached = templateCache.get(template);
  if (cached) return cached;
  if (templateCache.size >= TEMPLATE_CACHE_MAX) templateCache.clear();
  const segments = template.split('|').map(compileSegment);
  cached = { segments };
  templateCache.set(template, cached);
  return cached;
}

/** Resolve a bare {name} op. Returns `undefined` when the name is unresolvable
 *  (i.e., the original literal must be emitted). */
function runVar(name: string, ctx: TemplateContext): string | undefined {
  switch (name) {
    case 'basename': return ctx.basename;
    case 'dirname': return ctx.dirname;
    case 'heading': return ctx.heading ?? '';
    case 'line': return ctx.line ?? '';
    case 'content': return ctx.content;
    case 'filepath': return ctx.filePath ? ctx.filePath : undefined;
    case 'projectdir': return ctx.projectdir;
    case 'prefix': return ctx.prefix;
    default: return undefined;
  }
}

/** Walk a JSON path (pre-tokenized) and return the string value. */
function walkJsonPath(data: Record<string, unknown>, tokens: string[]): string {
  let current: unknown = data;
  for (let i = 0; i < tokens.length; i++) {
    if (current === null || current === undefined) return '';
    const token = tokens[i]!;
    if (token.startsWith('[')) {
      const indexMatch = INDEX_TOKEN_RE.exec(token);
      if (!indexMatch || !Array.isArray(current)) return '';
      const index = parseInt(indexMatch[1]!, 10);
      current = index < 0 ? current[current.length + index] : current[index];
    } else {
      if (typeof current !== 'object' || Array.isArray(current)) return '';
      current = (current as Record<string, unknown>)[token];
    }
  }
  if (current === null || current === undefined) return '';
  if (typeof current === 'object') return stringifyObject(current as object);
  return String(current);
}

function stringifyObject(obj: object): string {
  const cached = stringifyCache.get(obj);
  if (cached !== undefined) return cached;
  const result = JSON.stringify(obj);
  stringifyCache.set(obj, result);
  return result;
}

/** Evaluate one op against a context. */
function execOp(op: Op, ctx: TemplateContext, t: ValueTransform): string {
  if (op.k === OpKind.LIT) return op.v;

  if (ctx.values) {
    const v = ctx.values[op.raw];
    if (v !== undefined) return t(v);
  }

  switch (op.k) {
    case OpKind.VAR: {
      const resolved = runVar(op.name, ctx);
      return resolved !== undefined ? t(resolved) : `{${op.raw}}`;
    }
    case OpKind.DIRNAME_N:
      return ctx.filePath ? t(getDirname(ctx.filePath, op.level)) : `{${op.raw}}`;
    case OpKind.PATHDIR:
      return (ctx.filePath && ctx.basePath) ? t(getPathdir(ctx.filePath, ctx.basePath, op.level)) : `{${op.raw}}`;
    case OpKind.FRONTMATTER:
      return t(ctx.frontmatter[op.field] ?? '');
    case OpKind.ARGS:
      return ctx.args !== undefined ? t(ctx.args[op.key] ?? '') : `{${op.raw}}`;
    case OpKind.JSON:
      return ctx.jsonData ? t(walkJsonPath(ctx.jsonData, op.tokens)) : `{${op.raw}}`;
    case OpKind.JSON_PARENT: {
      const stack = ctx.parentJsonDataStack;
      if (!stack) return `{${op.raw}}`;
      const index = op.level - 1;
      if (index < 0 || index >= stack.length) return '';
      return t(walkJsonPath(stack[index]!, op.tokens));
    }
  }
}

/** Run an entire segment (literal + ops) and concatenate. */
function execSegment(seg: Segment, ctx: TemplateContext, t: ValueTransform): string {
  if (seg.length === 1) {
    const only = seg[0]!;
    if (only.k === OpKind.LIT) return only.v;
  }
  let out = '';
  for (let i = 0; i < seg.length; i++) {
    out += execOp(seg[i]!, ctx, t);
  }
  return out;
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
  valueTransform?: ValueTransform,
): string {
  const t = valueTransform ?? identity;
  const { segments } = compile(template);
  // Fallback chain: return first non-empty segment.
  for (let i = 0; i < segments.length; i++) {
    const result = execSegment(segments[i]!, context, t);
    if (result !== '') return result;
  }
  return '';
}

function identity(v: string): string { return v; }

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
  return walkJsonPath(data, tokenizeJsonPath(path));
}

/**
 * frontmatterの生テキストを取得
 */
export function extractRawFrontmatter(content: string): string {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  return frontmatterMatch?.[1]?.trim() ?? '';
}
