/**
 * Usage bonus calculator for search result scoring.
 * Provides bonus calculations based on usage frequency, recency, and file modification time.
 */

// Time constants
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Constants for bonus calculations
 */
export const USAGE_BONUS = {
  // Usage history related
  MAX_FREQUENCY: 200,
  MAX_USAGE_RECENCY: 300,
  FREQUENCY_LOG_BASE: 10,
  USAGE_RECENCY_TTL_DAYS: 7,

  // File modification time related
  MAX_FILE_MTIME: 1000,
  FILE_MTIME_TTL_DAYS: 7,
  FILE_MTIME_HALF_LIFE_MS: SIX_HOURS_MS, // Half-life for exponential decay
} as const;

/**
 * Calculate frequency bonus using logarithmic decay.
 * count=0 -> 0, count=1 -> 30, count=10 -> 60, count=100 -> 100
 *
 * @param count - Number of times the item has been used
 * @returns Bonus score (0 to MAX_FREQUENCY)
 */
export function calculateFrequencyBonus(count: number): number {
  if (count <= 0) return 0;

  const logCount = Math.log10(count + 1);
  const bonus = Math.floor(logCount * (USAGE_BONUS.MAX_FREQUENCY / 2));
  return Math.min(bonus, USAGE_BONUS.MAX_FREQUENCY);
}

/**
 * Calculate usage recency bonus using linear decay.
 * Within 24h -> 50, after 7 days -> 0
 *
 * @param lastUsed - Timestamp (ms) of last usage
 * @returns Bonus score (0 to MAX_USAGE_RECENCY)
 */
export function calculateUsageRecencyBonus(lastUsed: number): number {
  const now = Date.now();
  const age = now - lastUsed;

  // Within 24 hours: full bonus
  if (age < ONE_DAY_MS) {
    return USAGE_BONUS.MAX_USAGE_RECENCY;
  }

  const ttlMs = USAGE_BONUS.USAGE_RECENCY_TTL_DAYS * ONE_DAY_MS;

  // After TTL: no bonus
  if (age > ttlMs) {
    return 0;
  }

  // Linear decay between 24h and TTL
  const ratio = 1 - (age - ONE_DAY_MS) / (ttlMs - ONE_DAY_MS);
  return Math.floor(ratio * USAGE_BONUS.MAX_USAGE_RECENCY);
}

/**
 * Calculate file modification time bonus using hybrid decay.
 * Phase 1 (0-6h): Exponential decay with 6-hour half-life: 1000 → 500
 * Phase 2 (6h-24h): Linear decay: 500 → 200
 * Phase 3 (24h-7d): Linear decay: 200 → 0
 *
 * This gives strong priority to very recently edited files while still
 * providing meaningful bonuses for files edited within the past week.
 *
 * @param mtimeMs - File modification timestamp (ms)
 * @returns Bonus score (0 to MAX_FILE_MTIME)
 */
export function calculateFileMtimeBonus(mtimeMs: number): number {
  const now = Date.now();
  const age = now - mtimeMs;

  // Future timestamps get max bonus
  if (age <= 0) {
    return USAGE_BONUS.MAX_FILE_MTIME;
  }

  const ttlMs = USAGE_BONUS.FILE_MTIME_TTL_DAYS * ONE_DAY_MS;

  // After TTL (7 days): no bonus
  if (age >= ttlMs) {
    return 0;
  }

  // Hybrid decay:
  // Phase 1 (0-6h): Exponential decay 1000 → 500
  // Phase 2 (6h-24h): Linear decay 500 → 200
  // Phase 3 (24h-7d): Linear decay 200 → 0

  if (age < SIX_HOURS_MS) {
    // Phase 1: Exponential decay with 6-hour half-life
    const lambda = Math.LN2 / USAGE_BONUS.FILE_MTIME_HALF_LIFE_MS;
    return Math.floor(USAGE_BONUS.MAX_FILE_MTIME * Math.exp(-lambda * age));
  } else if (age < ONE_DAY_MS) {
    // Phase 2: Linear decay from 500 to 200
    const ratio = 1 - (age - SIX_HOURS_MS) / (ONE_DAY_MS - SIX_HOURS_MS);
    return Math.floor(200 + ratio * 300);
  } else {
    // Phase 3: Linear decay from 200 to 0
    const remainingTtl = ttlMs - ONE_DAY_MS;
    const ageAfterFirstDay = age - ONE_DAY_MS;
    const ratio = 1 - (ageAfterFirstDay / remainingTtl);
    return Math.floor(ratio * 200);
  }
}
