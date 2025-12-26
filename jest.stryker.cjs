// Jest configuration for Stryker mutation testing
module.exports = {
  preset: 'ts-jest',
  // Use Stryker's test environment for proper coverage reporting
  testEnvironment: '@stryker-mutator/jest-runner/jest-env/node',
  testEnvironmentOptions: {
    'localstorage-file': process.env.HOME + '/.jest-localstorage'
  },
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.{js,ts}',
    '**/?(*.)+(spec|test).{js,ts}'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/main.{js,ts}',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  forceExit: true
};
