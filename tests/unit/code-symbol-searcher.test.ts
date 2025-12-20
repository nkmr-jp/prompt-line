/**
 * CodeSymbolSearcher のユニットテスト
 */

import { CodeSymbolSearcher } from '../../src/lib/code-symbol-searcher';
import type { CodeSymbolSearchUserConfig } from '../../src/types';
import { spawn } from 'child_process';

// child_process のモック
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// language-patterns のモック
jest.mock('../../src/lib/language-patterns', () => ({
  LANGUAGE_PATTERNS: {
    typescript: {
      extensions: ['.ts', '.tsx'],
      rgType: 'ts',
      patterns: {
        class: '^export\\s+(default\\s+)?class\\s+(\\w+)',
        function: '^export\\s+(default\\s+)?(async\\s+)?function\\s+(\\w+)',
        interface: '^export\\s+(default\\s+)?interface\\s+(\\w+)'
      },
      defaultSymbols: ['class', 'function', 'interface']
    },
    go: {
      extensions: ['.go'],
      rgType: 'go',
      patterns: {
        func: '^func\\s+(\\w+)',
        struct: '^type\\s+(\\w+)\\s+struct',
        interface: '^type\\s+(\\w+)\\s+interface'
      },
      defaultSymbols: ['func', 'struct', 'interface']
    },
    python: {
      extensions: ['.py'],
      rgType: 'py',
      patterns: {
        class: '^class\\s+(\\w+)',
        def: '^def\\s+(\\w+)'
      },
      defaultSymbols: ['class', 'def']
    }
  },
  getSupportedLanguages: jest.fn(() => ['typescript', 'go', 'python'])
}));

describe('CodeSymbolSearcher', () => {
  let searcher: CodeSymbolSearcher;
  const mockConfig: CodeSymbolSearchUserConfig = {
    enabled: true,
    maxResults: 50,
    timeout: 5000
  };

  beforeEach(() => {
    searcher = new CodeSymbolSearcher(mockConfig);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('設定を正しく初期化すること', () => {
      expect(searcher).toBeDefined();
      expect(searcher['config']).toEqual(mockConfig);
    });
  });

  describe('getSupportedLanguages', () => {
    it('サポートされている言語のリストを返すこと', () => {
      const languages = searcher.getSupportedLanguages();
      expect(languages).toContain('typescript');
      expect(languages).toContain('go');
      expect(languages).toContain('python');
      expect(languages.length).toBe(3);
    });
  });

  describe('parsePrefix', () => {
    it('基本形式 @lang:query をパースできること', () => {
      const result = searcher.parsePrefix('@go:Handler');
      expect(result).toEqual({
        language: 'go',
        query: 'Handler'
      });
    });

    it('拡張形式 @lang:type:query をパースできること', () => {
      const result = searcher.parsePrefix('@ts:class:User');
      expect(result).toEqual({
        language: 'typescript',
        symbolType: 'class',
        query: 'User'
      });
    });

    it('言語エイリアス ts を typescript に変換すること', () => {
      const result = searcher.parsePrefix('@ts:Component');
      expect(result).toEqual({
        language: 'typescript',
        query: 'Component'
      });
    });

    it('言語エイリアス py を python に変換すること', () => {
      const result = searcher.parsePrefix('@py:main');
      expect(result).toEqual({
        language: 'python',
        query: 'main'
      });
    });

    it('無効な形式には null を返すこと - @ なし', () => {
      const result = searcher.parsePrefix('go:Handler');
      expect(result).toBeNull();
    });

    it('無効な形式には null を返すこと - コロンなし', () => {
      const result = searcher.parsePrefix('@goHandler');
      expect(result).toBeNull();
    });

    it('無効な形式には null を返すこと - クエリが空', () => {
      const result = searcher.parsePrefix('@go:');
      expect(result).toBeNull();
    });

    it('サポートされていない言語には null を返すこと', () => {
      const result = searcher.parsePrefix('@rust:main');
      expect(result).toBeNull();
    });

    it('存在しないシンボルタイプには null を返すこと', () => {
      const result = searcher.parsePrefix('@go:invalid:Handler');
      expect(result).toBeNull();
    });

    it('空文字列には null を返すこと', () => {
      const result = searcher.parsePrefix('');
      expect(result).toBeNull();
    });

    it('クエリに特殊文字が含まれていても正しくパースすること', () => {
      const result = searcher.parsePrefix('@go:Handle_Data');
      expect(result).toEqual({
        language: 'go',
        query: 'Handle_Data'
      });
    });
  });

  describe('buildRgArgs', () => {
    const mockLangConfig = {
      extensions: ['.go'],
      rgType: 'go',
      patterns: {
        func: '^func\\s+(\\w+)',
        struct: '^type\\s+(\\w+)\\s+struct'
      },
      defaultSymbols: ['func', 'struct']
    };

    it('基本的な引数を構築できること', () => {
      const args = searcher.buildRgArgs(mockLangConfig, '');
      expect(args).toContain('--json');
      expect(args).toContain('--line-number');
      expect(args).toContain('--column');
      expect(args).toContain('--type');
      expect(args).toContain('go');
      expect(args).toContain('--max-count');
      expect(args).toContain('50');
      expect(args).toContain('-e');
    });

    it('クエリが指定された場合はパターンに追加すること', () => {
      const args = searcher.buildRgArgs(mockLangConfig, 'Handler');
      const patternIndex = args.indexOf('-e') + 1;
      expect(args[patternIndex]).toContain('Handler');
      expect(args[patternIndex]).toContain('func');
    });

    it('特定のシンボルタイプが指定された場合はそのパターンのみ使用すること', () => {
      const args = searcher.buildRgArgs(mockLangConfig, 'Handler', ['func']);
      const patternIndex = args.indexOf('-e') + 1;
      expect(args[patternIndex]).toContain('func');
      expect(args[patternIndex]).toContain('Handler');
      expect(args[patternIndex]).not.toContain('struct');
    });

    it('複数のファイルタイプを処理できること', () => {
      const configWithMultipleTypes = {
        extensions: ['.ts', '.tsx'],
        rgType: 'ts',
        patterns: {
          class: '^export\\s+(default\\s+)?class\\s+(\\w+)'
        },
        defaultSymbols: ['class']
      };
      const args = searcher.buildRgArgs(configWithMultipleTypes, '');
      expect(args).toContain('--type');
      expect(args).toContain('ts');
    });

    it('maxResults 設定を反映すること', () => {
      searcher.updateConfig({ ...mockConfig, maxResults: 100 });
      const args = searcher.buildRgArgs(mockLangConfig, '');
      const maxCountIndex = args.indexOf('--max-count');
      expect(args[maxCountIndex + 1]).toBe('100');
    });
  });

  describe('parseRgOutput', () => {
    it('JSON 形式の出力を正しくパースすること', () => {
      const output = `{"type":"match","data":{"path":{"text":"src/handler.go"},"lines":{"text":"func HandleRequest() {"},"line_number":10,"absolute_offset":150,"submatches":[{"match":{"text":"HandleRequest"},"start":5,"end":18}]}}
{"type":"match","data":{"path":{"text":"src/server.go"},"lines":{"text":"func StartServer() {"},"line_number":20,"absolute_offset":300,"submatches":[{"match":{"text":"StartServer"},"start":5,"end":16}]}}`;

      const results = searcher.parseRgOutput(output, 'go');

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        file: 'src/handler.go',
        line: 10,
        column: 5,
        symbolName: 'HandleRequest',
        symbolType: 'symbol',
        matchedLine: 'func HandleRequest() {',
        language: 'go'
      });
      expect(results[1]).toEqual({
        file: 'src/server.go',
        line: 20,
        column: 5,
        symbolName: 'StartServer',
        symbolType: 'symbol',
        matchedLine: 'func StartServer() {',
        language: 'go'
      });
    });

    it('空の出力には空配列を返すこと', () => {
      const results = searcher.parseRgOutput('', 'go');
      expect(results).toEqual([]);
    });

    it('無効な JSON 行をスキップすること', () => {
      const output = `{"type":"match","data":{"path":{"text":"src/handler.go"},"lines":{"text":"func HandleRequest() {"},"line_number":10,"absolute_offset":150,"submatches":[{"match":{"text":"HandleRequest"},"start":5,"end":18}]}}
invalid json line
{"type":"match","data":{"path":{"text":"src/server.go"},"lines":{"text":"func StartServer() {"},"line_number":20,"absolute_offset":300,"submatches":[{"match":{"text":"StartServer"},"start":5,"end":16}]}}`;

      const results = searcher.parseRgOutput(output, 'go');
      expect(results).toHaveLength(2);
    });

    it('match タイプ以外の行をスキップすること', () => {
      const output = `{"type":"begin","data":{"path":{"text":"src/handler.go"}}}
{"type":"match","data":{"path":{"text":"src/handler.go"},"lines":{"text":"func HandleRequest() {"},"line_number":10,"absolute_offset":150,"submatches":[{"match":{"text":"HandleRequest"},"start":5,"end":18}]}}
{"type":"end","data":{"path":{"text":"src/handler.go"}}}`;

      const results = searcher.parseRgOutput(output, 'go');
      expect(results).toHaveLength(1);
    });

    it('submatches が空の場合は column を 0 にすること', () => {
      const output = `{"type":"match","data":{"path":{"text":"src/handler.go"},"lines":{"text":"func HandleRequest() {"},"line_number":10,"absolute_offset":150,"submatches":[]}}`;

      const results = searcher.parseRgOutput(output, 'go');
      expect(results).toHaveLength(1);
      expect(results[0]?.column).toBe(0);
      expect(results[0]?.symbolName).toBe('');
    });
  });

  describe('search', () => {
    it('rg コマンドを正しく実行すること', async () => {
      const mockStdout: any = {
        on: jest.fn((event: string, callback: any) => {
          if (event === 'data') {
            callback(Buffer.from('{"type":"match","data":{"path":{"text":"src/handler.go"},"lines":{"text":"func HandleRequest() {"},"line_number":10,"absolute_offset":150,"submatches":[{"match":{"text":"HandleRequest"},"start":5,"end":18}]}}'));
          }
          return mockStdout;
        })
      };

      const mockStderr: any = {
        on: jest.fn((_event: string, _callback: any) => {
          return mockStderr;
        })
      };

      const mockProcess: any = {
        stdout: mockStdout,
        stderr: mockStderr,
        on: jest.fn((event: string, callback: any) => {
          if (event === 'close') {
            callback(0);
          }
          return mockProcess;
        }),
        kill: jest.fn()
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const results = await searcher.search('/test/dir', 'go', 'Handler');

      expect(spawn).toHaveBeenCalledWith('rg', expect.any(Array), {
        cwd: '/test/dir'
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.symbolName).toBe('HandleRequest');
    });

    it('サポートされていない言語の場合はエラーをスローすること', async () => {
      await expect(searcher.search('/test/dir', 'rust', 'main')).rejects.toThrow('Unsupported language: rust');
    });

    it('タイムアウト時にエラーをスローすること', async () => {
      const mockProcess: any = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      searcher.updateConfig({ ...mockConfig, timeout: 100 });

      await expect(searcher.search('/test/dir', 'go', 'Handler')).rejects.toThrow('Search timeout after 100ms');
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('rg コマンドエラー（code 2+）の場合はエラーをスローすること', async () => {
      const mockStderr: any = {
        on: jest.fn((event: string, callback: any) => {
          if (event === 'data') {
            callback(Buffer.from('error message'));
          }
          return mockStderr;
        })
      };

      const mockProcess: any = {
        stdout: { on: jest.fn() },
        stderr: mockStderr,
        on: jest.fn((event: string, callback: any) => {
          if (event === 'close') {
            callback(2);
          }
          return mockProcess;
        }),
        kill: jest.fn()
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await expect(searcher.search('/test/dir', 'go', 'Handler')).rejects.toThrow('error message');
    });

    it('rg コマンドが結果なし（code 1）の場合は空配列を返すこと', async () => {
      const mockProcess: any = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event: string, callback: any) => {
          if (event === 'close') {
            callback(1);
          }
          return mockProcess;
        }),
        kill: jest.fn()
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const results = await searcher.search('/test/dir', 'go', 'NonExistent');
      expect(results).toEqual([]);
    });

    it('特定のシンボルタイプを指定して検索できること', async () => {
      const mockStdout: any = {
        on: jest.fn((event: string, callback: any) => {
          if (event === 'data') {
            callback(Buffer.from('{"type":"match","data":{"path":{"text":"src/handler.go"},"lines":{"text":"func HandleRequest() {"},"line_number":10,"absolute_offset":150,"submatches":[{"match":{"text":"HandleRequest"},"start":5,"end":18}]}}'));
          }
          return mockStdout;
        })
      };

      const mockProcess: any = {
        stdout: mockStdout,
        stderr: { on: jest.fn() },
        on: jest.fn((event: string, callback: any) => {
          if (event === 'close') {
            callback(0);
          }
          return mockProcess;
        }),
        kill: jest.fn()
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await searcher.search('/test/dir', 'go', 'Handler', 'func');

      const spawnArgs = (spawn as jest.Mock).mock.calls[0][1];
      expect(spawnArgs).toContain('-e');
      const patternIndex = spawnArgs.indexOf('-e') + 1;
      expect(spawnArgs[patternIndex]).toContain('func');
    });
  });

  describe('updateConfig', () => {
    it('設定を更新できること', () => {
      const newConfig: CodeSymbolSearchUserConfig = {
        enabled: false,
        maxResults: 100,
        timeout: 10000
      };

      searcher.updateConfig(newConfig);
      expect(searcher['config']).toEqual(newConfig);
    });

    it('部分的な設定更新ができること', () => {
      searcher.updateConfig({ maxResults: 200 } as CodeSymbolSearchUserConfig);
      expect(searcher['config'].maxResults).toBe(200);
      expect(searcher['config'].enabled).toBe(true);
      expect(searcher['config'].timeout).toBe(5000);
    });
  });
});
