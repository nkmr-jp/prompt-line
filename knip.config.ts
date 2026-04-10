import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/main.ts',
    'src/preload/preload.ts',
    'src/renderer/renderer.ts',
    'scripts/afterPack.js',
    'scripts/afterSign.js',
  ],
  project: ['src/**/*.ts', 'scripts/**/*.{js,ts}'],
  ignoreDependencies: [
    '@vscode/codicons',   // Font file copied locally, referenced in CSS
    'tailwindcss',        // Used via @tailwindcss/vite plugin and CSS @import
    'electron-builder',   // Used in package.json "build" config
  ],
  ignoreBinaries: [
    'make',     // Used in native tools compilation (cd native && make install)
    'tccutil',  // Used for resetting macOS accessibility permissions
  ],
  ignore: [
    // Barrel re-export files that knip can't trace through renderer process boundary
    'src/renderer/interfaces/index.ts',
    'src/renderer/mentions/code-search/index.ts',
  ],
};

export default config;
