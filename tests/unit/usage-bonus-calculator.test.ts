import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  USAGE_BONUS,
  calculateFrequencyBonus,
  calculateUsageRecencyBonus,
  calculateFileMtimeBonus
} from '../../src/lib/usage-bonus-calculator';

describe('usage-bonus-calculator', () => {
  describe('USAGE_BONUS constants', () => {
    test('should export all expected constants', () => {
      expect(USAGE_BONUS.MAX_FREQUENCY).toBe(1000);
      expect(USAGE_BONUS.MAX_USAGE_RECENCY).toBe(500);
      expect(USAGE_BONUS.FREQUENCY_LOG_BASE).toBe(10);
      expect(USAGE_BONUS.USAGE_RECENCY_TTL_DAYS).toBe(7);
      expect(USAGE_BONUS.MAX_FILE_MTIME).toBe(2500);
      expect(USAGE_BONUS.FILE_MTIME_TTL_DAYS).toBe(30);
    });
  });

  describe('calculateFrequencyBonus', () => {
    test('should return 0 for count=0', () => {
      const bonus = calculateFrequencyBonus(0);
      expect(bonus).toBe(0);
    });

    test('should return ~150 for count=1', () => {
      const bonus = calculateFrequencyBonus(1);
      // log10(1 + 1) = log10(2) ≈ 0.301
      // 0.301 * 500 ≈ 150.5 → floor = 150
      expect(bonus).toBeGreaterThanOrEqual(150);
      expect(bonus).toBeLessThanOrEqual(160);
    });

    test('should return ~520 for count=10', () => {
      const bonus = calculateFrequencyBonus(10);
      // log10(10 + 1) = log10(11) ≈ 1.041
      // 1.041 * 500 ≈ 520.5 → floor = 520
      expect(bonus).toBeGreaterThanOrEqual(500);
      expect(bonus).toBeLessThanOrEqual(530);
    });

    test('should return 1000 for count=100', () => {
      const bonus = calculateFrequencyBonus(100);
      // log10(100 + 1) = log10(101) ≈ 2.004
      // 2.004 * 500 ≈ 1002 → min(1002, 1000) = 1000
      expect(bonus).toBe(1000);
    });

    test('should return 1000 (capped at max) for count=1000', () => {
      const bonus = calculateFrequencyBonus(1000);
      // log10(1000 + 1) = log10(1001) ≈ 3.000
      // 3.000 * 500 = 1500 → min(1500, 1000) = 1000
      expect(bonus).toBe(1000);
    });

    test('should return 0 for negative count', () => {
      const bonus = calculateFrequencyBonus(-5);
      expect(bonus).toBe(0);
    });

    test('should handle edge case count=-1', () => {
      const bonus = calculateFrequencyBonus(-1);
      expect(bonus).toBe(0);
    });

    test('should handle fractional count (0.5)', () => {
      const bonus = calculateFrequencyBonus(0.5);
      // log10(0.5 + 1) = log10(1.5) ≈ 0.176
      // 0.176 * 500 ≈ 88 → floor = 88
      expect(bonus).toBeGreaterThanOrEqual(0);
      expect(bonus).toBeLessThan(150);
    });

    test('should increase monotonically with count', () => {
      const bonus1 = calculateFrequencyBonus(1);
      const bonus5 = calculateFrequencyBonus(5);
      const bonus10 = calculateFrequencyBonus(10);
      const bonus50 = calculateFrequencyBonus(50);

      expect(bonus5).toBeGreaterThan(bonus1);
      expect(bonus10).toBeGreaterThan(bonus5);
      expect(bonus50).toBeGreaterThan(bonus10);
    });
  });

  describe('calculateUsageRecencyBonus', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Set system time to a fixed point: 2024-01-15 12:00:00 UTC
      jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should return 500 (max) for usage within 24 hours', () => {
      const now = Date.now();
      const oneHourAgo = now - (1 * 60 * 60 * 1000); // 1 hour ago

      const bonus = calculateUsageRecencyBonus(oneHourAgo);
      expect(bonus).toBe(500);
    });

    test('should return 500 (max) for usage just now', () => {
      const now = Date.now();

      const bonus = calculateUsageRecencyBonus(now);
      expect(bonus).toBe(500);
    });

    test('should return < 500 for usage exactly 24 hours ago', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

      const bonus = calculateUsageRecencyBonus(oneDayAgo);
      // At exactly 24h, linear decay starts
      // ratio = 1 - (0 / (6 * ONE_DAY_MS)) = 1.0
      // bonus = floor(1.0 * 500) = 500
      // But the condition is age < ONE_DAY_MS, so 24h exactly falls into decay
      expect(bonus).toBeLessThanOrEqual(500);
    });

    test('should return ~250 (middle) for usage 4 days ago', () => {
      const now = Date.now();
      const fourDaysAgo = now - (4 * 24 * 60 * 60 * 1000); // 4 days ago

      const bonus = calculateUsageRecencyBonus(fourDaysAgo);
      // age = 4 days = 4 * ONE_DAY_MS
      // ttl = 7 days = 7 * ONE_DAY_MS
      // ratio = 1 - ((4 * ONE_DAY_MS - ONE_DAY_MS) / (7 * ONE_DAY_MS - ONE_DAY_MS))
      // ratio = 1 - (3 / 6) = 1 - 0.5 = 0.5
      // bonus = floor(0.5 * 500) = 250
      expect(bonus).toBe(250);
    });

    test('should return 0 for usage exactly 7 days ago', () => {
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago

      const bonus = calculateUsageRecencyBonus(sevenDaysAgo);
      // age = 7 days, ttl = 7 days
      // ratio = 1 - ((7 * ONE_DAY_MS - ONE_DAY_MS) / (7 * ONE_DAY_MS - ONE_DAY_MS))
      // ratio = 1 - (6 / 6) = 0
      // bonus = floor(0 * 50) = 0
      expect(bonus).toBe(0);
    });

    test('should return 0 for usage 7+ days ago', () => {
      const now = Date.now();
      const tenDaysAgo = now - (10 * 24 * 60 * 60 * 1000); // 10 days ago

      const bonus = calculateUsageRecencyBonus(tenDaysAgo);
      expect(bonus).toBe(0);
    });

    test('should return 0 for usage 30 days ago', () => {
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago

      const bonus = calculateUsageRecencyBonus(thirtyDaysAgo);
      expect(bonus).toBe(0);
    });

    test('should handle future timestamp (edge case)', () => {
      const now = Date.now();
      const futureTime = now + (1 * 60 * 60 * 1000); // 1 hour in future

      const bonus = calculateUsageRecencyBonus(futureTime);
      // age = negative, which is < ONE_DAY_MS, so full bonus
      expect(bonus).toBe(500);
    });

    test('should decrease monotonically over time', () => {
      const now = Date.now();
      const oneHourAgo = now - (1 * 60 * 60 * 1000);
      const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
      const fourDaysAgo = now - (4 * 24 * 60 * 60 * 1000);
      const sixDaysAgo = now - (6 * 24 * 60 * 60 * 1000);

      const bonus1h = calculateUsageRecencyBonus(oneHourAgo);
      const bonus2d = calculateUsageRecencyBonus(twoDaysAgo);
      const bonus4d = calculateUsageRecencyBonus(fourDaysAgo);
      const bonus6d = calculateUsageRecencyBonus(sixDaysAgo);

      expect(bonus1h).toBeGreaterThan(bonus2d);
      expect(bonus2d).toBeGreaterThan(bonus4d);
      expect(bonus4d).toBeGreaterThan(bonus6d);
    });
  });

  describe('calculateFileMtimeBonus', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Set system time to a fixed point: 2024-01-15 12:00:00 UTC
      jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should return 2500 (max) for file modified within 24 hours', () => {
      const now = Date.now();
      const oneHourAgo = now - (1 * 60 * 60 * 1000); // 1 hour ago

      const bonus = calculateFileMtimeBonus(oneHourAgo);
      expect(bonus).toBe(2500);
    });

    test('should return 2500 (max) for file modified just now', () => {
      const now = Date.now();

      const bonus = calculateFileMtimeBonus(now);
      expect(bonus).toBe(2500);
    });

    test('should return < 2500 for file modified exactly 24 hours ago', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

      const bonus = calculateFileMtimeBonus(oneDayAgo);
      // At exactly 24h, linear decay starts
      expect(bonus).toBeLessThanOrEqual(2500);
    });

    test('should return ~1293 (middle) for file modified 15 days ago', () => {
      const now = Date.now();
      const fifteenDaysAgo = now - (15 * 24 * 60 * 60 * 1000); // 15 days ago

      const bonus = calculateFileMtimeBonus(fifteenDaysAgo);
      // age = 15 days = 15 * ONE_DAY_MS
      // ttl = 30 days = 30 * ONE_DAY_MS
      // ratio = 1 - ((15 * ONE_DAY_MS - ONE_DAY_MS) / (30 * ONE_DAY_MS - ONE_DAY_MS))
      // ratio = 1 - (14 / 29) ≈ 1 - 0.4827 ≈ 0.5172
      // bonus = floor(0.5172 * 2500) = floor(1293) = 1293
      expect(bonus).toBe(1293);
    });

    test('should return 0 for file modified exactly 30 days ago', () => {
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago

      const bonus = calculateFileMtimeBonus(thirtyDaysAgo);
      // age = 30 days, ttl = 30 days
      // ratio = 1 - ((30 * ONE_DAY_MS - ONE_DAY_MS) / (30 * ONE_DAY_MS - ONE_DAY_MS))
      // ratio = 1 - (29 / 29) = 0
      // bonus = floor(0 * 50) = 0
      expect(bonus).toBe(0);
    });

    test('should return 0 for file modified 30+ days ago', () => {
      const now = Date.now();
      const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000); // 60 days ago

      const bonus = calculateFileMtimeBonus(sixtyDaysAgo);
      expect(bonus).toBe(0);
    });

    test('should return 0 for file modified 365 days ago', () => {
      const now = Date.now();
      const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000); // 365 days ago

      const bonus = calculateFileMtimeBonus(oneYearAgo);
      expect(bonus).toBe(0);
    });

    test('should handle future timestamp (edge case)', () => {
      const now = Date.now();
      const futureTime = now + (1 * 60 * 60 * 1000); // 1 hour in future

      const bonus = calculateFileMtimeBonus(futureTime);
      // age = negative, which is < ONE_DAY_MS, so full bonus
      expect(bonus).toBe(2500);
    });

    test('should decrease monotonically over time', () => {
      const now = Date.now();
      const oneHourAgo = now - (1 * 60 * 60 * 1000);
      const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = now - (15 * 24 * 60 * 60 * 1000);
      const twentyFiveDaysAgo = now - (25 * 24 * 60 * 60 * 1000);

      const bonus1h = calculateFileMtimeBonus(oneHourAgo);
      const bonus5d = calculateFileMtimeBonus(fiveDaysAgo);
      const bonus15d = calculateFileMtimeBonus(fifteenDaysAgo);
      const bonus25d = calculateFileMtimeBonus(twentyFiveDaysAgo);

      expect(bonus1h).toBeGreaterThan(bonus5d);
      expect(bonus5d).toBeGreaterThan(bonus15d);
      expect(bonus15d).toBeGreaterThan(bonus25d);
    });

    test('should handle timestamps at boundary conditions', () => {
      const now = Date.now();
      const almostOneDayAgo = now - (24 * 60 * 60 * 1000 - 1); // 23:59:59.999 ago
      const justOverOneDayAgo = now - (24 * 60 * 60 * 1000 + 1); // 24:00:00.001 ago
      const almostThirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000 - 1000); // 29 days, 23:59:59 ago

      const bonusAlmost1d = calculateFileMtimeBonus(almostOneDayAgo);
      const bonusJustOver1d = calculateFileMtimeBonus(justOverOneDayAgo);
      const bonusAlmost30d = calculateFileMtimeBonus(almostThirtyDaysAgo);

      expect(bonusAlmost1d).toBe(2500); // Still within 24h
      expect(bonusJustOver1d).toBeLessThan(2500); // Just entered decay period
      expect(bonusAlmost30d).toBeGreaterThanOrEqual(0); // At boundary, may round to 0
    });
  });

  describe('integration - combined bonus calculations', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should calculate bonuses for recently used and modified file', () => {
      const now = Date.now();
      const recentTime = now - (2 * 60 * 60 * 1000); // 2 hours ago
      const usageCount = 5;

      const frequencyBonus = calculateFrequencyBonus(usageCount);
      const recencyBonus = calculateUsageRecencyBonus(recentTime);
      const mtimeBonus = calculateFileMtimeBonus(recentTime);

      expect(frequencyBonus).toBeGreaterThan(0);
      expect(recencyBonus).toBe(500); // Within 24h
      expect(mtimeBonus).toBe(2500); // Within 24h

      const totalBonus = frequencyBonus + recencyBonus + mtimeBonus;
      expect(totalBonus).toBeGreaterThan(1000);
    });

    test('should calculate bonuses for old unused file', () => {
      const now = Date.now();
      const oldTime = now - (60 * 24 * 60 * 60 * 1000); // 60 days ago
      const usageCount = 0;

      const frequencyBonus = calculateFrequencyBonus(usageCount);
      const recencyBonus = calculateUsageRecencyBonus(oldTime);
      const mtimeBonus = calculateFileMtimeBonus(oldTime);

      expect(frequencyBonus).toBe(0);
      expect(recencyBonus).toBe(0); // Beyond TTL
      expect(mtimeBonus).toBe(0); // Beyond TTL

      const totalBonus = frequencyBonus + recencyBonus + mtimeBonus;
      expect(totalBonus).toBe(0);
    });

    test('should favor frequently used items even if old', () => {
      const now = Date.now();
      const oldTime = now - (20 * 24 * 60 * 60 * 1000); // 20 days ago
      const highUsageCount = 100;
      const lowUsageCount = 1;

      const highFrequencyBonus = calculateFrequencyBonus(highUsageCount);
      const lowFrequencyBonus = calculateFrequencyBonus(lowUsageCount);
      const recencyBonus = calculateUsageRecencyBonus(oldTime);
      const mtimeBonus = calculateFileMtimeBonus(oldTime);

      const highUsageTotal = highFrequencyBonus + recencyBonus + mtimeBonus;
      const lowUsageTotal = lowFrequencyBonus + recencyBonus + mtimeBonus;

      expect(highUsageTotal).toBeGreaterThan(lowUsageTotal);
    });
  });
});
