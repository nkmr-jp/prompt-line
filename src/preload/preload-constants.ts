/**
 * Preload Script Constants
 * Channel definitions and security configuration
 */

// Security: Only expose allowed IPC channels
export const ALLOWED_CHANNELS = [
  'paste-text',
  'paste-image',
  'get-history',
  'clear-history',
  'remove-history-item',
  'search-history',
  'save-draft',
  'clear-draft',
  'get-draft',
  'set-draft-directory',
  'get-draft-directory',
  'hide-window',
  'show-window',
  'get-config',
  'get-app-info',
  'focus-window',
  'window-shown',
  'get-slash-commands',
  'get-slash-command-file-path',
  'directory-data-updated',
  'open-settings',
  'get-agents',
  'get-agent-file-path',
  'get-md-search-max-suggestions',
  'get-md-search-prefixes',
  'open-file-in-editor',
  'check-file-exists',
  'open-external-url',
  // Code search channels
  'check-rg',
  'get-supported-languages',
  'search-symbols',
  'get-cached-symbols',
  'clear-symbol-cache'
];

// Security configuration
export const MAX_DEPTH = 10;
export const MAX_STRING_LENGTH = 1000000; // 1MB limit
export const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
