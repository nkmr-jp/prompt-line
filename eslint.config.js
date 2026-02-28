// eslint-disable-next-line @typescript-eslint/no-require-imports
const js = require('@eslint/js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tseslint = require('@typescript-eslint/eslint-plugin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsparser = require('@typescript-eslint/parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vitest = require('@vitest/eslint-plugin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const globals = require('globals');

// Custom rule to detect CSP-violating patterns
const noInlineStylesRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow inline styles that violate CSP',
      category: 'Security'
    },
    messages: {
      noCssText: 'Avoid using style.cssText as it may violate CSP. Use individual style properties instead.',
      noSetAttribute: 'Avoid using setAttribute with "style" as it may violate CSP. Use element.style.* instead.'
    }
  },
  create(context) {
    return {
      // Detect: element.style.cssText = '...'
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          node.left.property.name === 'cssText' &&
          node.left.object.type === 'MemberExpression' &&
          node.left.object.property.name === 'style'
        ) {
          context.report({ node, messageId: 'noCssText' });
        }
      },
      // Detect: element.setAttribute('style', '...')
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'setAttribute' &&
          node.arguments.length >= 1 &&
          node.arguments[0].type === 'Literal' &&
          node.arguments[0].value === 'style'
        ) {
          context.report({ node, messageId: 'noSetAttribute' });
        }
      }
    };
  }
};

module.exports = [
  js.configs.recommended,
  {
    ignores: ['eslint.config.js', 'dist/**/*']
  },
  // Global rules for all source files
  {
    files: ['src/**/*.ts', 'tests/**/*.{js,ts}'],
    rules: {
      // File length limit
      // 'max-lines': [
      //   'warn',
      //   {
      //     max: 300,
      //     skipBlankLines: true,
      //     skipComments: true
      //   }
      // ],
      // nestif equivalent: max nesting depth
      'max-depth': ['warn', 4],
      // funlen equivalent: max function length
      'max-lines-per-function': [
        'warn',
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true
        }
      ],
      // funlen equivalent: max statements per function
      'max-statements': ['warn', 15]
    }
  },
  // Node.js scripts configuration
  {
    files: ['scripts/**/*.js', 'test-functionality.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off'
    }
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        NodeJS: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'no-console': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-control-regex': 'off'
    }
  },
  {
    files: ['src/renderer/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        NodeJS: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'csp-rules': { rules: { 'no-inline-styles': noInlineStylesRule } }
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // CSP: Prevent inline styles that violate Content Security Policy
      'csp-rules/no-inline-styles': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'no-console': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-control-regex': 'off'
    }
  },
  {
    files: ['src/preload/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        NodeJS: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'no-console': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-control-regex': 'off'
    }
  },
  {
    files: ['tests/**/*.{js,ts}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        NodeJS: 'readonly',
        vi: 'readonly',
        vitest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        suite: 'readonly',
        captureConsole: 'readonly',
        createMockHistoryItem: 'readonly',
        createMockDraft: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      vitest: vitest
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...vitest.configs.recommended.rules,
      // 意味のないテストを検出するルール
      'vitest/expect-expect': 'warn', // アサーションがないテストを検出
      'vitest/no-disabled-tests': 'warn', // スキップされたテスト（.skip, xit）を検出
      'vitest/no-focused-tests': 'error', // .only を使ったテストを検出（CI失敗防止）
      'vitest/no-identical-title': 'error', // 同じタイトルのテストを検出
      'vitest/valid-expect': 'error', // 無効なexpect()を検出
      'vitest/no-standalone-expect': 'error', // describe/it外のexpectを検出
      'vitest/prefer-to-have-length': 'warn', // .length よりも .toHaveLength() を推奨
      'vitest/prefer-to-be': 'warn', // toBe(null/undefined) を推奨
      'vitest/no-conditional-expect': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'no-console': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off'
    }
  }
];