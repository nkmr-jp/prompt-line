import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,js}'],
    root: '.',
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/main.{js,ts}', '**/node_modules/**'],
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov', 'html'],
    },
    css: false,
    pool: 'forks',
    clearMocks: true,
    sequence: { hooks: 'list' },
  },
});
