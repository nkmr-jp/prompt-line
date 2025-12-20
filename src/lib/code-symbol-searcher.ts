/**
 * コードシンボル検索機能
 *
 * ripgrep (rg) を使用してコードベース内のシンボル（関数、クラス、インターフェースなど）を検索します。
 */

import { spawn } from 'child_process';
import type { CodeSymbolSearchUserConfig, SymbolSearchResult, ParsedSymbolPrefix, LanguageSymbolConfig } from '../types';
import { LANGUAGE_PATTERNS, getSupportedLanguages as getLanguages } from './language-patterns';

/**
 * 言語エイリアスマッピング
 * ユーザーが短縮形でも指定できるようにする
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  cpp: 'c++',
  cs: 'csharp'
};

export class CodeSymbolSearcher {
  private config: CodeSymbolSearchUserConfig;

  constructor(userConfig: CodeSymbolSearchUserConfig) {
    this.config = userConfig;
  }

  /**
   * サポートされている言語のリストを取得
   */
  getSupportedLanguages(): string[] {
    return getLanguages();
  }

  /**
   * プレフィックスをパースして言語、シンボルタイプ、クエリを抽出
   *
   * @param input - 入力文字列（例: "@go:Handler", "@ts:class:User"）
   * @returns パース結果、無効な場合は null
   */
  parsePrefix(input: string): ParsedSymbolPrefix | null {
    // 基本形式: @lang:query
    // 拡張形式: @lang:type:query
    const match = input.match(/^@([a-z]+):([^:]+)(?::(.+))?$/i);
    if (!match) {
      return null;
    }

    const [, rawLang, maybeTypeOrQuery, maybeQuery] = match;

    if (!rawLang) {
      return null;
    }

    // 言語エイリアスを解決
    const language = LANGUAGE_ALIASES[rawLang.toLowerCase()] || rawLang.toLowerCase();

    // サポートされている言語かチェック
    if (!this.getSupportedLanguages().includes(language)) {
      return null;
    }

    const langConfig = LANGUAGE_PATTERNS[language];
    if (!langConfig) {
      return null;
    }

    // 拡張形式の場合
    if (maybeQuery) {
      const symbolType = maybeTypeOrQuery;
      const query = maybeQuery;

      // シンボルタイプが存在するかチェック
      if (symbolType && !langConfig.patterns[symbolType]) {
        return null;
      }

      // クエリが空でないかチェック
      if (!query || !query.trim()) {
        return null;
      }

      // symbolType が空文字列の場合は undefined を返す
      if (!symbolType) {
        return {
          language,
          query: query.trim()
        };
      }

      return {
        language,
        symbolType,
        query: query.trim()
      };
    }

    // 基本形式の場合
    const query = maybeTypeOrQuery;

    // クエリが空でないかチェック
    if (!query || !query.trim()) {
      return null;
    }

    return {
      language,
      query: query.trim()
    };
  }

  /**
   * ripgrep のコマンドライン引数を構築
   *
   * @param langConfig - 言語設定
   * @param query - 検索クエリ
   * @param symbolTypes - 特定のシンボルタイプ（指定しない場合はすべて）
   * @returns rg コマンドの引数配列
   */
  buildRgArgs(langConfig: LanguageSymbolConfig, query: string, symbolTypes?: string[]): string[] {
    const args: string[] = [
      '--json',                    // JSON 出力
      '--line-number',             // 行番号を含める
      '--column',                  // カラム番号を含める
    ];

    // ファイルタイプフィルタ（rgType を使用）
    args.push('--type', langConfig.rgType);

    // 最大結果数
    args.push('--max-count', this.config.maxResults.toString());

    // パターン構築
    let pattern: string;

    if (symbolTypes && symbolTypes.length > 0) {
      // 特定のシンボルタイプが指定されている場合
      const patterns = symbolTypes
        .map((type: string) => langConfig.patterns[type])
        .filter(Boolean);
      pattern = patterns.join('|');
    } else {
      // デフォルトシンボルのパターンを使用
      const defaultPatterns = langConfig.defaultSymbols
        .map((type: string) => langConfig.patterns[type])
        .filter(Boolean);
      pattern = defaultPatterns.join('|');
    }

    // クエリがある場合はパターンに組み込む
    if (query) {
      // セキュリティ: 正規表現メタ文字をエスケープ
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = `(${pattern}).*${escapedQuery}`;
    }

    args.push('-e', pattern);

    return args;
  }

  /**
   * ripgrep の JSON 出力をパースして結果配列に変換
   *
   * @param output - rg の標準出力
   * @param language - 検索言語
   * @returns パース済みの検索結果配列
   */
  parseRgOutput(output: string, language: string): SymbolSearchResult[] {
    const results: SymbolSearchResult[] = [];

    if (!output.trim()) {
      return results;
    }

    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const json = JSON.parse(line);

        // match タイプのみ処理
        if (json.type !== 'match') {
          continue;
        }

        const data = json.data;
        const submatch = data.submatches?.[0];

        results.push({
          file: data.path.text,
          line: data.line_number,
          column: submatch?.start ?? 0,
          symbolName: submatch?.match?.text ?? '',
          symbolType: 'symbol',
          matchedLine: data.lines.text,
          language
        });
      } catch {
        // 無効な JSON 行はスキップ
        continue;
      }
    }

    return results;
  }

  /**
   * コードシンボルを検索
   *
   * @param directory - 検索ディレクトリ
   * @param language - プログラミング言語
   * @param query - 検索クエリ
   * @param symbolType - シンボルタイプ（オプション）
   * @returns 検索結果の配列
   */
  async search(
    directory: string,
    language: string,
    query: string,
    symbolType?: string
  ): Promise<SymbolSearchResult[]> {
    // サポートされている言語かチェック
    if (!this.getSupportedLanguages().includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const langConfig = LANGUAGE_PATTERNS[language];
    if (!langConfig) {
      throw new Error(`Language config not found: ${language}`);
    }

    const symbolTypes = symbolType ? [symbolType] : undefined;
    const args = this.buildRgArgs(langConfig!, query, symbolTypes);

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      let timeoutId: NodeJS.Timeout;

      const proc = spawn('rg', args, {
        cwd: directory
      });

      // タイムアウト処理
      timeoutId = setTimeout(() => {
        proc.kill();
        reject(new Error(`Search timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      // 標準出力
      proc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      // 標準エラー出力
      proc.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      // プロセス終了
      proc.on('close', (code: number | null) => {
        clearTimeout(timeoutId);

        // code 0: 成功（結果あり）
        // code 1: 成功（結果なし）
        // code 2+: エラー
        if (code === 0 || code === 1) {
          const results = this.parseRgOutput(output, language);
          resolve(results);
        } else {
          reject(new Error(errorOutput || `rg command failed with code ${code}`));
        }
      });
    });
  }

  /**
   * 設定を更新
   *
   * @param config - 新しい設定
   */
  updateConfig(config: CodeSymbolSearchUserConfig): void {
    this.config = { ...this.config, ...config };
  }
}
