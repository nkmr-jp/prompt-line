import {
  LANGUAGE_PATTERNS,
  getSupportedLanguages,
  getLanguageConfig,
  detectLanguageByExtension
} from '../../src/lib/language-patterns';

describe('language-patterns', () => {
  describe('LANGUAGE_PATTERNS 定数', () => {
    it('全ての言語が正しく定義されているか', () => {
      const expectedLanguages = [
        'go', 'ts', 'js', 'py', 'rs', 'java', 'c', 'cpp',
        'rb', 'php', 'swift', 'kt', 'sh'
      ];

      expectedLanguages.forEach(lang => {
        expect(LANGUAGE_PATTERNS[lang]).toBeDefined();
        expect(LANGUAGE_PATTERNS[lang]!.extensions).toBeInstanceOf(Array);
        expect(LANGUAGE_PATTERNS[lang]!.rgType).toBeTruthy();
        expect(LANGUAGE_PATTERNS[lang]!.patterns).toBeDefined();
        expect(LANGUAGE_PATTERNS[lang]!.defaultSymbols).toBeInstanceOf(Array);
      });
    });

    it('Go のパターンが正しく定義されているか', () => {
      const goConfig = LANGUAGE_PATTERNS.go!;
      expect(goConfig.extensions).toEqual(['.go']);
      expect(goConfig.rgType).toBe('go');
      expect(goConfig.patterns.func).toBe('^func\\s+(\\w+)');
      expect(goConfig.patterns.struct).toBe('^type\\s+(\\w+)\\s+struct');
      expect(goConfig.patterns.interface).toBe('^type\\s+(\\w+)\\s+interface');
      expect(goConfig.patterns.const).toBe('^const\\s+(\\w+)');
      expect(goConfig.patterns.var).toBe('^var\\s+(\\w+)');
      expect(goConfig.defaultSymbols).toEqual(['func', 'struct', 'interface']);
    });

    it('TypeScript のパターンが正しく定義されているか', () => {
      const tsConfig = LANGUAGE_PATTERNS.ts!;
      expect(tsConfig.extensions).toEqual(['.ts', '.tsx']);
      expect(tsConfig.rgType).toBe('ts');
      expect(tsConfig.patterns.class).toBe('^export\\s+(default\\s+)?class\\s+(\\w+)');
      expect(tsConfig.patterns.function).toBe('^export\\s+(default\\s+)?(async\\s+)?function\\s+(\\w+)');
      expect(tsConfig.patterns.interface).toBe('^export\\s+(default\\s+)?interface\\s+(\\w+)');
      expect(tsConfig.patterns.type).toBe('^export\\s+(default\\s+)?type\\s+(\\w+)');
      expect(tsConfig.patterns.const).toBe('^export\\s+(default\\s+)?const\\s+(\\w+)');
      expect(tsConfig.patterns.enum).toBe('^export\\s+(default\\s+)?enum\\s+(\\w+)');
      expect(tsConfig.defaultSymbols).toEqual(['class', 'function', 'interface', 'type']);
    });

    it('Python のパターンが正しく定義されているか', () => {
      const pyConfig = LANGUAGE_PATTERNS.py!;
      expect(pyConfig.extensions).toEqual(['.py']);
      expect(pyConfig.rgType).toBe('py');
      expect(pyConfig.patterns.class).toBe('^class\\s+(\\w+)');
      expect(pyConfig.patterns.def).toBe('^def\\s+(\\w+)');
      expect(pyConfig.patterns.async_def).toBe('^async\\s+def\\s+(\\w+)');
      expect(pyConfig.defaultSymbols).toEqual(['class', 'def']);
    });

    it('Rust のパターンが正しく定義されているか', () => {
      const rsConfig = LANGUAGE_PATTERNS.rs!;
      expect(rsConfig.extensions).toEqual(['.rs']);
      expect(rsConfig.rgType).toBe('rust');
      expect(rsConfig.patterns.fn).toBe('^pub\\s+fn\\s+(\\w+)');
      expect(rsConfig.patterns.struct).toBe('^pub\\s+struct\\s+(\\w+)');
      expect(rsConfig.patterns.enum).toBe('^pub\\s+enum\\s+(\\w+)');
      expect(rsConfig.patterns.trait).toBe('^pub\\s+trait\\s+(\\w+)');
      expect(rsConfig.patterns.impl).toBe('^impl(?:<[^>]+>)?\\s+(\\w+)');
      expect(rsConfig.patterns.type).toBe('^pub\\s+type\\s+(\\w+)');
      expect(rsConfig.patterns.mod).toBe('^pub\\s+mod\\s+(\\w+)');
      expect(rsConfig.defaultSymbols).toEqual(['fn', 'struct', 'enum', 'trait']);
    });
  });

  describe('getSupportedLanguages', () => {
    it('サポートされている全言語のリストを返すか', () => {
      const languages = getSupportedLanguages();
      expect(languages).toBeInstanceOf(Array);
      expect(languages.length).toBeGreaterThan(0);

      // 期待される言語が全て含まれているか
      const expectedLanguages = [
        'go', 'ts', 'js', 'py', 'rs', 'java', 'c', 'cpp',
        'rb', 'php', 'swift', 'kt', 'sh'
      ];
      expectedLanguages.forEach(lang => {
        expect(languages).toContain(lang);
      });
    });

    it('重複がないか', () => {
      const languages = getSupportedLanguages();
      const uniqueLanguages = [...new Set(languages)];
      expect(languages).toEqual(uniqueLanguages);
    });
  });

  describe('getLanguageConfig', () => {
    it('存在する言語の設定を正しく返すか', () => {
      const goConfig = getLanguageConfig('go');
      expect(goConfig).toBeDefined();
      expect(goConfig?.extensions).toEqual(['.go']);
      expect(goConfig?.rgType).toBe('go');
    });

    it('存在しない言語で undefined を返すか', () => {
      const config = getLanguageConfig('unknown');
      expect(config).toBeUndefined();
    });

    it('大文字小文字が違う場合は undefined を返すか', () => {
      const config = getLanguageConfig('GO');
      expect(config).toBeUndefined();
    });

    it('空文字列で undefined を返すか', () => {
      const config = getLanguageConfig('');
      expect(config).toBeUndefined();
    });
  });

  describe('detectLanguageByExtension', () => {
    it('.go 拡張子から go を返すか', () => {
      expect(detectLanguageByExtension('.go')).toBe('go');
    });

    it('.ts 拡張子から ts を返すか', () => {
      expect(detectLanguageByExtension('.ts')).toBe('ts');
    });

    it('.tsx 拡張子から ts を返すか', () => {
      expect(detectLanguageByExtension('.tsx')).toBe('ts');
    });

    it('.js 拡張子から js を返すか', () => {
      expect(detectLanguageByExtension('.js')).toBe('js');
    });

    it('.py 拡張子から py を返すか', () => {
      expect(detectLanguageByExtension('.py')).toBe('py');
    });

    it('.rs 拡張子から rs を返すか', () => {
      expect(detectLanguageByExtension('.rs')).toBe('rs');
    });

    it('存在しない拡張子で undefined を返すか', () => {
      expect(detectLanguageByExtension('.unknown')).toBeUndefined();
    });

    it('空文字列で undefined を返すか', () => {
      expect(detectLanguageByExtension('')).toBeUndefined();
    });

    it('ドットなしの拡張子で undefined を返すか', () => {
      expect(detectLanguageByExtension('go')).toBeUndefined();
    });

    it('複数のドットを含む場合は最後の拡張子のみで判定するか', () => {
      expect(detectLanguageByExtension('.test.go')).toBe('go');
    });
  });

  describe('実際のコードサンプルとのマッチング', () => {
    describe('Go', () => {
      it('func パターンが関数定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.go!.patterns.func!, 'm');
        expect(pattern.test('func main() {')).toBe(true);
        expect(pattern.test('func NewServer() *Server {')).toBe(true);
        expect(pattern.test('  func invalid()')).toBe(false); // インデント付きは除外
      });

      it('struct パターンが構造体定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.go!.patterns.struct!, 'm');
        expect(pattern.test('type User struct {')).toBe(true);
        expect(pattern.test('type Server struct {')).toBe(true);
        expect(pattern.test('type User interface {')).toBe(false);
      });
    });

    describe('TypeScript', () => {
      it('class パターンがクラス定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.ts!.patterns.class!, 'm');
        expect(pattern.test('export class User {')).toBe(true);
        expect(pattern.test('export default class Server {')).toBe(true);
        expect(pattern.test('class Local {')).toBe(false); // export なしは除外
      });

      it('function パターンが関数定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.ts!.patterns.function!, 'm');
        expect(pattern.test('export function calculate() {')).toBe(true);
        expect(pattern.test('export async function fetchData() {')).toBe(true);
        expect(pattern.test('export default function main() {')).toBe(true);
        expect(pattern.test('function local() {')).toBe(false); // export なしは除外
      });

      it('interface パターンがインターフェース定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.ts!.patterns.interface!, 'm');
        expect(pattern.test('export interface User {')).toBe(true);
        expect(pattern.test('export default interface Config {')).toBe(true);
      });
    });

    describe('Python', () => {
      it('class パターンがクラス定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.py!.patterns.class!, 'm');
        expect(pattern.test('class User:')).toBe(true);
        expect(pattern.test('class MyClass(BaseClass):')).toBe(true);
        expect(pattern.test('  class Nested:')).toBe(false); // インデント付きは除外
      });

      it('def パターンが関数定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.py!.patterns.def!, 'm');
        expect(pattern.test('def calculate():')).toBe(true);
        expect(pattern.test('def process(data):')).toBe(true);
        expect(pattern.test('  def method(self):')).toBe(false); // インデント付きは除外
      });

      it('async_def パターンが非同期関数定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.py!.patterns.async_def!, 'm');
        expect(pattern.test('async def fetch_data():')).toBe(true);
        expect(pattern.test('def sync_func():')).toBe(false);
      });
    });

    describe('Rust', () => {
      it('fn パターンが関数定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.rs!.patterns.fn!, 'm');
        expect(pattern.test('pub fn calculate() {')).toBe(true);
        expect(pattern.test('pub fn new() -> Self {')).toBe(true);
        expect(pattern.test('fn private() {')).toBe(false); // pub なしは除外
      });

      it('struct パターンが構造体定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.rs!.patterns.struct!, 'm');
        expect(pattern.test('pub struct User {')).toBe(true);
        expect(pattern.test('struct Private {')).toBe(false); // pub なしは除外
      });

      it('impl パターンが実装ブロックにマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.rs!.patterns.impl!, 'm');
        expect(pattern.test('impl User {')).toBe(true);
        expect(pattern.test('impl<T> Container<T> {')).toBe(true);
      });
    });

    describe('JavaScript', () => {
      it('class パターンがクラス定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.js!.patterns.class!, 'm');
        expect(pattern.test('export class User {')).toBe(true);
        expect(pattern.test('export default class Server {')).toBe(true);
      });

      it('function パターンが関数定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.js!.patterns.function!, 'm');
        expect(pattern.test('export function calculate() {')).toBe(true);
        expect(pattern.test('export default function main() {')).toBe(true);
      });
    });

    describe('Java', () => {
      it('class パターンがクラス定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.java!.patterns.class!, 'm');
        expect(pattern.test('public class User {')).toBe(true);
        expect(pattern.test('public final class Server {')).toBe(true);
        expect(pattern.test('class Package {')).toBe(false); // public なしは除外
      });

      it('method パターンがメソッド定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.java!.patterns.method!, 'm');
        expect(pattern.test('    public void calculate() {')).toBe(true);
        expect(pattern.test('    public static String format() {')).toBe(true);
        expect(pattern.test('    private void internal() {')).toBe(false); // public/protected なしは除外
      });
    });

    describe('C', () => {
      it('function パターンが関数定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.c!.patterns.function!, 'm');
        expect(pattern.test('int main() {')).toBe(true);
        expect(pattern.test('void calculate(int x) {')).toBe(true);
        expect(pattern.test('static int helper() {')).toBe(true);
      });

      it('struct パターンが構造体定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.c!.patterns.struct!, 'm');
        expect(pattern.test('struct user {')).toBe(true);
        expect(pattern.test('typedef struct server {')).toBe(true);
      });
    });

    describe('Shell', () => {
      it('function パターンが関数定義にマッチするか', () => {
        const pattern = new RegExp(LANGUAGE_PATTERNS.sh!.patterns.function!, 'm');
        expect(pattern.test('function deploy() {')).toBe(true);
        expect(pattern.test('deploy() {')).toBe(true);
        expect(pattern.test('  function nested() {')).toBe(false); // インデント付きは除外
      });
    });
  });

  describe('エッジケース', () => {
    it('全ての言語が少なくとも1つのデフォルトシンボルを持つか', () => {
      const languages = getSupportedLanguages();
      languages.forEach((lang: string) => {
        const config = getLanguageConfig(lang);
        expect(config?.defaultSymbols.length).toBeGreaterThan(0);
      });
    });

    it('全てのデフォルトシンボルに対応するパターンが存在するか', () => {
      const languages = getSupportedLanguages();
      languages.forEach((lang: string) => {
        const config = getLanguageConfig(lang);
        config?.defaultSymbols.forEach((symbol: string) => {
          expect(config.patterns[symbol]).toBeDefined();
        });
      });
    });

    it('拡張子の重複がないか', () => {
      const allExtensions: string[] = [];
      const languages = getSupportedLanguages();

      languages.forEach((lang: string) => {
        const config = getLanguageConfig(lang);
        config?.extensions.forEach((ext: string) => {
          expect(allExtensions).not.toContain(ext);
          allExtensions.push(ext);
        });
      });
    });

    it('rgType が空文字列でないか', () => {
      const languages = getSupportedLanguages();
      languages.forEach((lang: string) => {
        const config = getLanguageConfig(lang);
        expect(config?.rgType).toBeTruthy();
        expect(config?.rgType.length).toBeGreaterThan(0);
      });
    });
  });
});
