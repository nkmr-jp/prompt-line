/**
 * Default settings for Prompt Line
 *
 * This is the single source of truth for default settings.
 *
 * Two exports:
 * - defaultSettings: Runtime defaults (used by app-config.ts, settings-manager.ts)
 * - exampleSettings: Example file defaults (used by generate-settings-example.ts)
 *
 * When modifying defaults:
 * 1. Update this file
 * 2. Run: npm run generate:settings-example
 * 3. Commit both this file and settings.example.yml
 */

import type { UserSettings } from '../types';

/**
 * Default settings - used at runtime
 * These are the actual defaults when user has no settings.yml
 */
export const defaultSettings: UserSettings = {
  shortcuts: {
    main: 'Cmd+Shift+Space',
    paste: 'Cmd+Enter',
    close: 'Escape',
    historyNext: 'Ctrl+j',
    historyPrev: 'Ctrl+k',
    search: 'Cmd+f'
  },
  window: {
    position: 'active-text-field',
    width: 600,
    height: 300
  },
  fileOpener: {
    extensions: {},
    defaultEditor: null
  },
  mentions: {
    fileSearch: {
      respectGitignore: true,
      includeHidden: true,
      maxFiles: 5000,
      maxDepth: null,
      maxSuggestions: 50,
      followSymlinks: false,
      includePatterns: [],
      excludePatterns: []
    },
    symbolSearch: {
      maxSymbols: 20000,
      timeout: 5000
    }
  }
};

/**
 * Example settings - used for generating settings.example.yml
 * Extends defaultSettings with sample configurations
 */
export const exampleSettings: UserSettings = {
  ...defaultSettings,
  fileOpener: {
    ...defaultSettings.fileOpener,
    extensions: {
      go: 'Goland'
      // md: 'Typora',
      // pdf: 'Preview'
    }
  },
  slashCommands: {
    builtIn: ['claude'],
    custom: [
      {
        name: '{basename}',
        description: '{frontmatter@description}',
        path: '~/.claude/commands',
        pattern: '*.md',
        argumentHint: '{frontmatter@argument-hint}',
        maxSuggestions: 20
      }
    ]
  },
  mentions: {
    ...defaultSettings.mentions,
    mdSearch: [
      {
        name: 'agent-{basename}',
        description: '{frontmatter@description}',
        path: '~/.claude/agents',
        pattern: '*.md',
        searchPrefix: 'agent'
      },
      {
        name: '{frontmatter@name}',
        description: '{frontmatter@description}',
        path: '~/.claude/skills',
        pattern: '**/*/SKILL.md',
        searchPrefix: 'skill'
      }
    ]
  }
};

/**
 * Commented-out example entries for settings.example.yml
 * These are shown as comments in the generated file
 */
export const commentedExamples = {
  slashCommands: {
    builtIn: ['codex', 'gemini']
  },
  fileOpener: {
    extensions: {
      md: 'Typora',
      pdf: 'Preview'
    }
  },
  mentions: {
    mdSearch: [
      {
        name: '{frontmatter@name}',
        description: '{frontmatter@description}',
        path: '~/.claude/plugins',
        pattern: '**/*/SKILL.md',
        searchPrefix: 'skill'
      },
      {
        name: '{basename}',
        description: '{frontmatter@title}',
        path: '/path/to/knowledge-base',
        pattern: '**/*/*.md',
        searchPrefix: 'kb',
        maxSuggestions: 100,
        sortOrder: 'desc',
        inputFormat: 'path'
      }
    ]
  }
};
