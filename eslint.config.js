// eslint-disable-next-line @typescript-eslint/no-require-imports
const js = require('@eslint/js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tseslint = require('@typescript-eslint/eslint-plugin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsparser = require('@typescript-eslint/parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jest = require('eslint-plugin-jest');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        node: true,
        jest: true,
        console: true,
        process: true,
        Buffer: true,
        __dirname: true,
        __filename: true,
        global: true,
        module: true,
        require: true,
        exports: true,
        setTimeout: true,
        clearTimeout: true,
        setInterval: true,
        clearInterval: true,
        setImmediate: true,
        clearImmediate: true
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      jest: jest
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_'
        }
      ],
      'no-console': 'off',
      '@typescript-eslint/ban-types': 'off'
    }
  },
  {
    files: ['tests/**/*.{js,ts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  }
];