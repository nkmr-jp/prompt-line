/**
 * Application constants - centralized location for all magic numbers and configuration values
 */
// @ts-nocheck


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
  MINIMUM_WINDOW_HIDE_DELAY: 5
} as const;

// Delay constants for various operations
export const DELAYS = {
  DEFAULT_DRAFT_SAVE: 500
} as const;

// Size and limit constants
export const LIMITS = {
  MAX_VISIBLE_ITEMS: 50,
  MAX_SEARCH_ITEMS: 5000,
  MAX_CACHE_ITEMS: 200,
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
  LIMITS,
  UI_TIMING,
  SUGGESTIONS,
  VALIDATION,
  FUZZY_MATCH_SCORES,
  TIME_CALCULATIONS,
} as const;