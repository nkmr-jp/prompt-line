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
  MINIMUM_WINDOW_HIDE_DELAY: 5
} as const;

// Delay constants for various operations
export const DELAYS = {
  DEFAULT_DRAFT_SAVE: 500
} as const;

// Size and limit constants
export const LIMITS = {
  MAX_VISIBLE_ITEMS: 200,
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
  TIME_CALCULATIONS,
} as const;