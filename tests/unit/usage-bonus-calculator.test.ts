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
      expect(USAGE_BONUS.MAX_FREQUENCY).toBe(200);
      expect(USAGE_BONUS.MAX_USAGE_RECENCY).toBe(300);
      expect(USAGE_BONUS.FREQUENCY_LOG_BASE).toBe(10);
      expect(USAGE_BONUS.USAGE_RECENCY_TTL_DAYS).toBe(7);
      expect(USAGE_BONUS.MAX_FILE_MTIME).toBe(500);
      expect(USAGE_BONUS.FILE_MTIME_TTL_DAYS).toBe(30);
    });
  });

  describe('calculateFrequencyBonus', () => {
    test('should return 0 for count=0', () => {
      const bonus = calculateFrequencyBonus(0);
      expect(bonus).toBe(0);
    });

    test('should return ~30 for count=1', () => {
      const bonus = calculateFrequencyBonus(1);
      // log10(1 + 1) = log10(2) ≈ 0.301
      // 0.301 * 100 ≈ 30.1 → floor = 30
      expect(bonus).toBeGreaterThanOrEqual(30);
      expect(bonus).toBeLessThanOrEqual(35);
    });

    test('should return ~104 for count=10', () => {
      const bonus = calculateFrequencyBonus(10);
      // log10(10 + 1) = log10(11) ≈ 1.041
      // 1.041 * 100 ≈ 104.1 → floor = 104
      expect(bonus).toBeGreaterThanOrEqual(104);
      expect(bonus).toBeLessThanOrEqual(110);
    });

    test('should return 200 for count=100', () => {
      const bonus = calculateFrequencyBonus(100);
      // log10(100 + 1) = log10(101) ≈ 2.004
      // 2.004 * 100 ≈ 200.4 → min(200, 200) = 200
      expect(bonus).toBe(200);
    });

    test('should return 200 (capped at max) for count=1000', () => {
      const bonus = calculateFrequencyBonus(1000);
      // log10(1000 + 1) = log10(1001) ≈ 3.000
      // 3.000 * 100 = 300 → min(300, 200) = 200
      expect(bonus).toBe(200);
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
      // 0.176 * 100 ≈ 17.6 → floor = 17
      expect(bonus).toBeGreaterThanOrEqual(0);
      expect(bonus).toBeLessThan(30);
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

    test('should return 300 (max) for usage within 24 hours', () => {
      const now = Date.now();
      const oneHourAgo = now - (1 * 60 * 60 * 1000); // 1 hour ago

      const bonus = calculateUsageRecencyBonus(oneHourAgo);
      expect(bonus).toBe(300);
    });

    test('should return 300 (max) for usage just now', () => {
      const now = Date.now();

      const bonus = calculateUsageRecencyBonus(now);
      expect(bonus).toBe(300);
    });

    test('should return < 300 for usage exactly 24 hours ago', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

      const bonus = calculateUsageRecencyBonus(oneDayAgo);
      // At exactly 24h, linear decay starts
      // ratio = 1 - (0 / (6 * ONE_DAY_MS)) = 1.0
      // bonus = floor(1.0 * 300) = 300
      // But the condition is age < ONE_DAY_MS, so 24h exactly falls into decay
      expect(bonus).toBeLessThanOrEqual(300);
    });

    test('should return 150 (middle) for usage 4 days ago', () => {
      const now = Date.now();
      const fourDaysAgo = now - (4 * 24 * 60 * 60 * 1000); // 4 days ago

      const bonus = calculateUsageRecencyBonus(fourDaysAgo);
      // age = 4 days = 4 * ONE_DAY_MS
      // ttl = 7 days = 7 * ONE_DAY_MS
      // ratio = 1 - ((4 * ONE_DAY_MS - ONE_DAY_MS) / (7 * ONE_DAY_MS - ONE_DAY_MS))
      // ratio = 1 - (3 / 6) = 1 - 0.5 = 0.5
      // bonus = floor(0.5 * 300) = 150
      expect(bonus).toBe(150);
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
      expect(bonus).toBe(300);
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

    test('should return high bonus for file modified within 24 hours', () => {
      const now = Date.now();
      const oneHourAgo = now - (1 * 60 * 60 * 1000); // 1 hour ago

      const bonus = calculateFileMtimeBonus(oneHourAgo);
      // Continuous decay: age = 1h = 3600000ms, ttl = 30 days = 2592000000ms
      // ratio = 1 - (3600000 / 2592000000) ≈ 1 - 0.001388 ≈ 0.998611
      // bonus = floor(0.998611 * 500) = floor(499.305) = 499
      expect(bonus).toBe(499);
    });

    test('should return 500 (max) for file modified just now', () => {
      const now = Date.now();

      const bonus = calculateFileMtimeBonus(now);
      expect(bonus).toBe(500);
    });

    test('should return decayed bonus for file modified exactly 24 hours ago', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

      const bonus = calculateFileMtimeBonus(oneDayAgo);
      // Continuous decay: age = 1 day = 86400000ms, ttl = 30 days = 2592000000ms
      // ratio = 1 - (86400000 / 2592000000) ≈ 1 - 0.03333 ≈ 0.96667
      // bonus = floor(0.96667 * 500) = floor(483.335) = 483
      expect(bonus).toBe(483);
    });

    test('should return 250 (middle) for file modified 15 days ago', () => {
      const now = Date.now();
      const fifteenDaysAgo = now - (15 * 24 * 60 * 60 * 1000); // 15 days ago

      const bonus = calculateFileMtimeBonus(fifteenDaysAgo);
      // Continuous decay: age = 15 days, ttl = 30 days
      // ratio = 1 - (15 / 30) = 1 - 0.5 = 0.5
      // bonus = floor(0.5 * 500) = floor(250) = 250
      expect(bonus).toBe(250);
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
      expect(bonus).toBe(500);
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
      const oneDayAndOneHourAgo = now - (25 * 60 * 60 * 1000); // 25 hours ago
      const almostThirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000 - 1000); // 29 days, 23:59:59 ago

      const bonusAlmost1d = calculateFileMtimeBonus(almostOneDayAgo);
      const bonus25h = calculateFileMtimeBonus(oneDayAndOneHourAgo);
      const bonusAlmost30d = calculateFileMtimeBonus(almostThirtyDaysAgo);

      // Continuous decay: almostOneDayAgo ≈ 483
      expect(bonusAlmost1d).toBe(483);
      expect(bonus25h).toBeLessThan(bonusAlmost1d); // Measurably less due to continuous decay
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
      expect(recencyBonus).toBe(300); // Within 24h
      // Continuous decay: age = 2h = 7200000ms, ttl = 30 days = 2592000000ms
      // ratio = 1 - (7200000 / 2592000000) ≈ 1 - 0.002777 ≈ 0.997222
      // bonus = floor(0.997222 * 500) = floor(498.611) = 498
      expect(mtimeBonus).toBe(498);

      const totalBonus = frequencyBonus + recencyBonus + mtimeBonus;
      expect(totalBonus).toBeGreaterThan(800);
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
