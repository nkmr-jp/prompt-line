// @ts-nocheck
// eslint-disable-next-line @typescript-eslint/no-require-imports
const js = require('@eslint/js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tseslint = require('@typescript-eslint/eslint-plugin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsparser = require('@typescript-eslint/parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jest = require('eslint-plugin-jest');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const globals = require('globals');

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
        ...globals.jest,
        NodeJS: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      jest: jest
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...jest.configs.recommended.rules,
      // 意味のないテストを検出するルール
      'jest/expect-expect': 'warn', // アサーションがないテストを検出
      'jest/no-disabled-tests': 'warn', // スキップされたテスト（.skip, xit）を検出
      'jest/no-focused-tests': 'error', // .only を使ったテストを検出（CI失敗防止）
      'jest/no-identical-title': 'error', // 同じタイトルのテストを検出
      'jest/valid-expect': 'error', // 無効なexpect()を検出
      'jest/no-standalone-expect': 'error', // describe/it外のexpectを検出
      'jest/prefer-to-have-length': 'warn', // .length よりも .toHaveLength() を推奨
      'jest/prefer-to-be': 'warn', // toBe(null/undefined) を推奨
      'jest/no-conditional-expect': 'off',
      'jest/no-done-callback': 'off',
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