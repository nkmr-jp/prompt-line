/**
 * Application constants - centralized location for all magic numbers and configuration values
 */

// Time-related constants
export const TIMEOUTS = {
  WINDOW_BLUR_HIDE_DELAY: 150,
  TEXTAREA_FOCUS_DELAY: 50,
  FLASH_ANIMATION_DURATION: 400,
  KEYBOARD_NAVIGATION_TIMEOUT: 3000,
  ERROR_MESSAGE_DURATION: 3000,
  CURRENT_APP_TIMEOUT: 2000,
  NATIVE_PASTE_TIMEOUT: 1500,
  ACCESSIBILITY_CHECK_TIMEOUT: 3000,
  WINDOW_BOUNDS_TIMEOUT: 3000,
  ACTIVATE_PASTE_TIMEOUT: 3000,
  MINIMUM_WINDOW_HIDE_DELAY: 5,
  // Background detection and native tools
  BACKGROUND_DETECTION: 5000,
  NATIVE_TOOL_EXECUTION: 3000,
  TEXT_FIELD_DETECTION: 3000,
  SYMBOL_SEARCH: 5000,
  SHORT_OPERATION: 1000,
  DESKTOP_SPACE_DETECTION: 5000
} as const;

// Delay constants for various operations
export const DELAYS = {
  DEFAULT_DRAFT_SAVE: 500
} as const;

// Debounce timing constants for text input (in milliseconds)
export const DEBOUNCE = {
  SHORT_TEXT: 500,
  LONG_TEXT: 1000,
  TEXT_LENGTH_THRESHOLD: 200
} as const;

// Size and limit constants
export const LIMITS = {
  MAX_VISIBLE_ITEMS: 50,
  MAX_SEARCH_ITEMS: 5000,
  MAX_CACHE_ITEMS: 200,
  MAX_FILES: 5000,
  MAX_BACKUP_AGE: 7 * 24 * 60 * 60 * 1000,
  MAX_ERROR_LOG_LENGTH: 500
} as const;

// Cache TTL (Time To Live) constants (in milliseconds)
export const CACHE_TTL = {
  MD_SEARCH: 5000,
  SYMBOL_MEMORY: 5 * 60 * 1000,
  DESKTOP_SPACE: 2000
} as const;

// UI timing constants
export const UI_TIMING = {
  POPUP_HIDE_DELAY: 100,
} as const;

// Suggestion constants
export const SUGGESTIONS = {
  DEFAULT_MAX: 20,
} as const;

// Validation constants
export const VALIDATION = {
  MAX_ID_LENGTH: 32,
} as const;

// Fuzzy match scoring constants
export const FUZZY_MATCH_SCORES = {
  EXACT: 1000,
  STARTS_WITH: 500,
  CONTAINS: 200,
  PATH_CONTAINS: 50,
  BASE_FUZZY: 10,
  FILE_BONUS: 5,
  MAX_PATH_BONUS: 20,
  AGENT_BASE: 50,
} as const;

// Time calculation constants
export const TIME_CALCULATIONS = {
  MILLISECONDS_PER_MINUTE: 60000,
  MILLISECONDS_PER_HOUR: 3600000,
  MILLISECONDS_PER_DAY: 86400000,
  TIMESTAMP_BASE: 36,
  RANDOM_ID_START: 2,
  RANDOM_ID_END: 11
} as const;

// Export all constants as a single object for convenience
export const CONSTANTS = {
  TIMEOUTS,
  DELAYS,
  DEBOUNCE,
  LIMITS,
  CACHE_TTL,
  UI_TIMING,
  SUGGESTIONS,
  VALIDATION,
  FUZZY_MATCH_SCORES,
  TIME_CALCULATIONS,
} as const;