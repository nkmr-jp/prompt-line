import type { LanguageSymbolConfig } from '../types';

/**
 * 言語別のシンボル検索パターン定義
 *
 * 各言語のコードシンボル（関数、クラス、構造体など）を検索するための
 * 正規表現パターンと設定を提供します。
 */
export const LANGUAGE_PATTERNS: Record<string, LanguageSymbolConfig> = {
  // Go言語
  go: {
    extensions: ['.go'],
    rgType: 'go',
    patterns: {
      func: '^func\\s+(\\w+)',
      struct: '^type\\s+(\\w+)\\s+struct',
      interface: '^type\\s+(\\w+)\\s+interface',
      const: '^const\\s+(\\w+)',
      var: '^var\\s+(\\w+)',
    },
    defaultSymbols: ['func', 'struct', 'interface'],
  },

  // TypeScript
  ts: {
    extensions: ['.ts', '.tsx'],
    rgType: 'ts',
    patterns: {
      class: '^export\\s+(default\\s+)?class\\s+(\\w+)',
      function: '^export\\s+(default\\s+)?(async\\s+)?function\\s+(\\w+)',
      interface: '^export\\s+(default\\s+)?interface\\s+(\\w+)',
      type: '^export\\s+(default\\s+)?type\\s+(\\w+)',
      const: '^export\\s+(default\\s+)?const\\s+(\\w+)',
      enum: '^export\\s+(default\\s+)?enum\\s+(\\w+)',
    },
    defaultSymbols: ['class', 'function', 'interface', 'type'],
  },

  // JavaScript
  js: {
    extensions: ['.js', '.jsx'],
    rgType: 'js',
    patterns: {
      class: '^export\\s+(default\\s+)?class\\s+(\\w+)',
      function: '^export\\s+(default\\s+)?(async\\s+)?function\\s+(\\w+)',
      const: '^export\\s+(default\\s+)?const\\s+(\\w+)',
      let: '^export\\s+(default\\s+)?let\\s+(\\w+)',
    },
    defaultSymbols: ['class', 'function', 'const'],
  },

  // Python
  py: {
    extensions: ['.py'],
    rgType: 'py',
    patterns: {
      class: '^class\\s+(\\w+)',
      def: '^def\\s+(\\w+)',
      async_def: '^async\\s+def\\s+(\\w+)',
    },
    defaultSymbols: ['class', 'def'],
  },

  // Rust
  rs: {
    extensions: ['.rs'],
    rgType: 'rust',
    patterns: {
      fn: '^pub\\s+fn\\s+(\\w+)',
      struct: '^pub\\s+struct\\s+(\\w+)',
      enum: '^pub\\s+enum\\s+(\\w+)',
      trait: '^pub\\s+trait\\s+(\\w+)',
      impl: '^impl(?:<[^>]+>)?\\s+(\\w+)',
      type: '^pub\\s+type\\s+(\\w+)',
      mod: '^pub\\s+mod\\s+(\\w+)',
    },
    defaultSymbols: ['fn', 'struct', 'enum', 'trait'],
  },

  // Java
  java: {
    extensions: ['.java'],
    rgType: 'java',
    patterns: {
      class: '^public\\s+(?:final\\s+|abstract\\s+)?class\\s+(\\w+)',
      interface: '^public\\s+interface\\s+(\\w+)',
      enum: '^public\\s+enum\\s+(\\w+)',
      method: '^\\s+public\\s+(?:static\\s+)?(?:\\w+\\s+)+(\\w+)\\s*\\(',
    },
    defaultSymbols: ['class', 'interface', 'method'],
  },

  // C
  c: {
    extensions: ['.c', '.h'],
    rgType: 'c',
    patterns: {
      function: '^(?:static\\s+)?\\w+\\s+(\\w+)\\s*\\([^)]*\\)\\s*\\{',
      struct: '^(?:typedef\\s+)?struct\\s+(\\w+)',
      enum: '^(?:typedef\\s+)?enum\\s+(\\w+)',
      define: '^#define\\s+(\\w+)',
    },
    defaultSymbols: ['function', 'struct'],
  },

  // C++
  cpp: {
    extensions: ['.cpp', '.hpp', '.cc', '.hh', '.cxx'],
    rgType: 'cpp',
    patterns: {
      class: '^class\\s+(\\w+)',
      function: '^(?:static\\s+)?(?:inline\\s+)?\\w+\\s+(\\w+)\\s*\\([^)]*\\)\\s*(?:const\\s+)?\\{',
      namespace: '^namespace\\s+(\\w+)',
      template: '^template\\s*<[^>]+>\\s*(?:class|struct)\\s+(\\w+)',
    },
    defaultSymbols: ['class', 'function', 'namespace'],
  },

  // Ruby
  rb: {
    extensions: ['.rb'],
    rgType: 'ruby',
    patterns: {
      class: '^class\\s+(\\w+)',
      module: '^module\\s+(\\w+)',
      def: '^def\\s+(\\w+)',
    },
    defaultSymbols: ['class', 'module', 'def'],
  },

  // PHP
  php: {
    extensions: ['.php'],
    rgType: 'php',
    patterns: {
      class: '^class\\s+(\\w+)',
      interface: '^interface\\s+(\\w+)',
      trait: '^trait\\s+(\\w+)',
      function: '^function\\s+(\\w+)',
    },
    defaultSymbols: ['class', 'function'],
  },

  // Swift
  swift: {
    extensions: ['.swift'],
    rgType: 'swift',
    patterns: {
      class: '^(?:public\\s+|private\\s+|internal\\s+)?class\\s+(\\w+)',
      struct: '^(?:public\\s+|private\\s+|internal\\s+)?struct\\s+(\\w+)',
      enum: '^(?:public\\s+|private\\s+|internal\\s+)?enum\\s+(\\w+)',
      protocol: '^(?:public\\s+|private\\s+|internal\\s+)?protocol\\s+(\\w+)',
      func: '^(?:public\\s+|private\\s+|internal\\s+)?func\\s+(\\w+)',
    },
    defaultSymbols: ['class', 'struct', 'protocol', 'func'],
  },

  // Kotlin
  kt: {
    extensions: ['.kt', '.kts'],
    rgType: 'kotlin',
    patterns: {
      class: '^(?:public\\s+|private\\s+|internal\\s+)?(?:open\\s+|abstract\\s+)?class\\s+(\\w+)',
      interface: '^(?:public\\s+|private\\s+|internal\\s+)?interface\\s+(\\w+)',
      object: '^(?:public\\s+|private\\s+|internal\\s+)?object\\s+(\\w+)',
      fun: '^(?:public\\s+|private\\s+|internal\\s+)?fun\\s+(\\w+)',
    },
    defaultSymbols: ['class', 'interface', 'fun'],
  },

  // Shell Script
  sh: {
    extensions: ['.sh', '.bash', '.zsh'],
    rgType: 'sh',
    patterns: {
      function: '^(?:function\\s+)?(\\w+)\\s*\\(\\s*\\)\\s*\\{',
    },
    defaultSymbols: ['function'],
  },
};

/**
 * サポートされている言語の一覧を取得
 *
 * @returns サポートされている言語のキーの配列
 *
 * @example
 * ```typescript
 * const languages = getSupportedLanguages();
 * console.log(languages); // ['go', 'ts', 'js', 'py', ...]
 * ```
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_PATTERNS);
}

/**
 * 指定された言語の設定を取得
 *
 * @param lang - 言語キー（例: 'go', 'ts', 'py'）
 * @returns 言語の設定、存在しない場合は undefined
 *
 * @example
 * ```typescript
 * const goConfig = getLanguageConfig('go');
 * if (goConfig) {
 *   console.log(goConfig.extensions); // ['.go']
 *   console.log(goConfig.patterns.func); // '^func\\s+(\\w+)'
 * }
 * ```
 */
export function getLanguageConfig(lang: string): LanguageSymbolConfig | undefined {
  return LANGUAGE_PATTERNS[lang];
}

/**
 * ファイル拡張子から言語を検出
 *
 * @param ext - ファイル拡張子（ドット付き、例: '.go', '.ts'）
 * @returns 検出された言語キー、検出できない場合は undefined
 *
 * @example
 * ```typescript
 * const lang = detectLanguageByExtension('.go');
 * console.log(lang); // 'go'
 *
 * const lang2 = detectLanguageByExtension('.tsx');
 * console.log(lang2); // 'ts'
 *
 * const lang3 = detectLanguageByExtension('.unknown');
 * console.log(lang3); // undefined
 * ```
 */
export function detectLanguageByExtension(ext: string): string | undefined {
  if (!ext) {
    return undefined;
  }

  // 複数のドットを含む場合は最後の拡張子を使用（例: '.test.go' -> '.go'）
  let normalizedExt = ext;
  if (ext.startsWith('.') && ext.lastIndexOf('.') > 0) {
    // '.test.go' のような場合、最後の '.' 以降を取得して '.' を付ける
    normalizedExt = '.' + ext.substring(ext.lastIndexOf('.') + 1);
  }

  for (const [lang, config] of Object.entries(LANGUAGE_PATTERNS)) {
    if (config.extensions.includes(normalizedExt)) {
      return lang;
    }
  }

  return undefined;
}
