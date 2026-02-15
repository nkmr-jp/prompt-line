/**
 * Default settings for Prompt Line
 *
 * This is the SINGLE SOURCE OF TRUTH for all default settings.
 *
 * Used by:
 * - app-config.ts (application configuration)
 * - settings-manager.ts (runtime defaults)
 * - generate-settings-example.ts (settings.example.yml generation)
 *
 * IMPORTANT: defaultSettings = runtime defaults = settings.example.yml active values
 * This ensures no discrepancy between what users see and what they get.
 *
 * When modifying defaults:
 * 1. Update this file
 * 2. Run: npm run generate:settings-example
 * 3. Commit both this file and settings.example.yml
 */

import type { UserSettings } from '../types';

/**
 * Default settings - the single source of truth
 *
 * These are:
 * - The actual runtime defaults when user has no settings.yml
 * - The active (non-commented) values in settings.example.yml
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
    extensions: {
      png: 'Preview',
      pdf: 'Preview'
    },
    defaultEditor: null
  },
  builtInCommands: ['claude'],
  agentSkills: [
    {
      name: '{basename}',
      description: '{frontmatter@description}',
      path: '~/.claude/commands',
      label: 'command',
      color: 'purple',
      pattern: '*.md',
      argumentHint: '{frontmatter@argument-hint}',
      maxSuggestions: 20
    },
    {
      name: '{frontmatter@name}',
      description: '{frontmatter@description}',
      path: '~/.claude/skills',
      label: 'skill',
      color: 'purple',
      pattern: '**/*/SKILL.md',
      maxSuggestions: 20
    },
    {
      name: '{prefix}:{basename}',
      description: '{frontmatter@description}',
      path: '~/.claude/plugins/cache',
      pattern: '**/commands/*.md',
      prefixPattern: '**/.claude-plugin/*.json@name',
      label: 'command',
      color: 'teal',
      argumentHint: '{frontmatter@argument-hint}',
      maxSuggestions: 20
    },
    {
      name: '{prefix}:{frontmatter@name}',
      description: '{frontmatter@description}',
      path: '~/.claude/plugins/cache',
      pattern: '**/*/SKILL.md',
      prefixPattern: '**/.claude-plugin/*.json@name',
      label: 'skill',
      color: 'teal',
      argumentHint: '{frontmatter@argument-hint}',
      maxSuggestions: 20
    }
  ],
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
      maxSymbols: 200000,
      timeout: 60000,
      includePatterns: [],
      excludePatterns: []
    },
    customSearch: [
      {
        name: '{basename}(agent)',
        description: '{frontmatter@description}',
        path: '~/.claude/agents',
        pattern: '*.md',
        searchPrefix: 'agent'
      },
      {
        name: '{prefix}:{basename}(agent)',
        description: '{frontmatter@description}',
        path: '~/.claude/plugins/cache',
        pattern: '**/agents/*.md',
        prefixPattern: '**/.claude-plugin/*.json@name',
        searchPrefix: 'agent'
      },
      {
        name: '{basename}',
        description: '{dirname:2}',
        path: '~/.claude/teams',
        pattern: '**/inboxes/*.json',
        searchPrefix: 'team'
      },
      {
        name: '{json@name}',
        description: '{dirname:2}',
        path: '~/.claude/teams',
        pattern: '**/config.json',
        searchPrefix: 'member',
        jsonArrayPath: 'members'
      },
      {
        name: '{basename}',
        description: '',
        path: '~/.claude/plans',
        pattern: '*.md',
        searchPrefix: 'plan',
        inputFormat: 'path'
      },
      {
        name: '{basename}',
        description: '{dirname}',
        path: '~/.claude/tasks',
        pattern: '**/*/*.md',
        searchPrefix: 'task',
        inputFormat: 'path'
      }
    ]
  }
};

/**
 * Additional example entries shown as comments in settings.example.yml
 *
 * These are NOT runtime defaults - they are just examples to help users
 * understand available options.
 */
export const commentedExamples = {
  builtInCommands: ['openclaw', 'codex', 'gemini'],
  agentSkills: [] as Array<{
    name: string;
    description: string;
    path: string;
    pattern: string;
    argumentHint?: string;
  }>,
  fileOpener: {
    extensions: {
      go: 'Goland',
      md: 'Typora'
    }
  },
  mentions: {
    customSearch: [
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
