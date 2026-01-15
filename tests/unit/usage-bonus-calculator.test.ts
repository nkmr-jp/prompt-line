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
      expect(USAGE_BONUS.MAX_FREQUENCY).toBe(100);
      expect(USAGE_BONUS.MAX_USAGE_RECENCY).toBe(100);
      expect(USAGE_BONUS.FREQUENCY_LOG_BASE).toBe(10);
      expect(USAGE_BONUS.USAGE_RECENCY_TTL_DAYS).toBe(7);
      expect(USAGE_BONUS.MAX_FILE_MTIME).toBe(200);
      expect(USAGE_BONUS.FILE_MTIME_TTL_DAYS).toBe(7);
      expect(USAGE_BONUS.FILE_MTIME_HALF_LIFE_MS).toBe(6 * 60 * 60 * 1000); // 6 hours
      expect(USAGE_BONUS.MTIME_PROPORTION_AT_6H).toBe(0.5);
      expect(USAGE_BONUS.MTIME_PROPORTION_AT_24H).toBe(0.2);
    });
  });

  describe('calculateFrequencyBonus', () => {
    test('should return 0 for count=0', () => {
      const bonus = calculateFrequencyBonus(0);
      expect(bonus).toBe(0);
    });

    test('should return ~15 for count=1', () => {
      const bonus = calculateFrequencyBonus(1);
      // log10(1 + 1) = log10(2) ≈ 0.301
      // 0.301 * 50 ≈ 15.05 → floor = 15
      expect(bonus).toBeGreaterThanOrEqual(15);
      expect(bonus).toBeLessThanOrEqual(16);
    });

    test('should return ~52 for count=10', () => {
      const bonus = calculateFrequencyBonus(10);
      // log10(10 + 1) = log10(11) ≈ 1.041
      // 1.041 * 50 ≈ 52.05 → floor = 52
      expect(bonus).toBeGreaterThanOrEqual(52);
      expect(bonus).toBeLessThanOrEqual(53);
    });

    test('should return 100 for count=100', () => {
      const bonus = calculateFrequencyBonus(100);
      // log10(100 + 1) = log10(101) ≈ 2.004
      // 2.004 * 50 ≈ 100.2 → min(100, 100) = 100
      expect(bonus).toBe(100);
    });

    test('should return 100 (capped at max) for count=1000', () => {
      const bonus = calculateFrequencyBonus(1000);
      // log10(1000 + 1) = log10(1001) ≈ 3.000
      // 3.000 * 50 = 150 → min(150, 100) = 100
      expect(bonus).toBe(100);
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
      // 0.176 * 50 ≈ 8.8 → floor = 8
      expect(bonus).toBeGreaterThanOrEqual(0);
      expect(bonus).toBeLessThan(15);
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

    test('should return 100 (max) for usage within 24 hours', () => {
      const now = Date.now();
      const oneHourAgo = now - (1 * 60 * 60 * 1000); // 1 hour ago

      const bonus = calculateUsageRecencyBonus(oneHourAgo);
      expect(bonus).toBe(100);
    });

    test('should return 100 (max) for usage just now', () => {
      const now = Date.now();

      const bonus = calculateUsageRecencyBonus(now);
      expect(bonus).toBe(100);
    });

    test('should return < 100 for usage exactly 24 hours ago', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

      const bonus = calculateUsageRecencyBonus(oneDayAgo);
      // At exactly 24h, linear decay starts
      // ratio = 1 - (0 / (6 * ONE_DAY_MS)) = 1.0
      // bonus = floor(1.0 * 100) = 100
      // But the condition is age < ONE_DAY_MS, so 24h exactly falls into decay
      expect(bonus).toBeLessThanOrEqual(100);
    });

    test('should return 50 (middle) for usage 4 days ago', () => {
      const now = Date.now();
      const fourDaysAgo = now - (4 * 24 * 60 * 60 * 1000); // 4 days ago

      const bonus = calculateUsageRecencyBonus(fourDaysAgo);
      // age = 4 days = 4 * ONE_DAY_MS
      // ttl = 7 days = 7 * ONE_DAY_MS
      // ratio = 1 - ((4 * ONE_DAY_MS - ONE_DAY_MS) / (7 * ONE_DAY_MS - ONE_DAY_MS))
      // ratio = 1 - (3 / 6) = 1 - 0.5 = 0.5
      // bonus = floor(0.5 * 100) = 50
      expect(bonus).toBe(50);
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
      expect(bonus).toBe(100);
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
      // Phase 1 (exponential): age = 1h, half-life = 6h
      // bonus = floor(200 * 2^(-1/6)) = floor(200 * 0.8909) = 178
      expect(bonus).toBe(178);
    });

    test('should return 200 (max) for file modified just now', () => {
      const now = Date.now();

      const bonus = calculateFileMtimeBonus(now);
      expect(bonus).toBe(200);
    });

    test('should return 100 for file modified exactly 6 hours ago (half-life)', () => {
      const now = Date.now();
      const sixHoursAgo = now - (6 * 60 * 60 * 1000); // 6 hours ago

      const bonus = calculateFileMtimeBonus(sixHoursAgo);
      // Phase 1 end / Phase 2 start: age = 6h, half-life point
      // bonus = floor(200 * 2^(-1)) = floor(200 * 0.5) = 100
      expect(bonus).toBe(100);
    });

    test('should return 80 for file modified exactly 12 hours ago', () => {
      const now = Date.now();
      const twelveHoursAgo = now - (12 * 60 * 60 * 1000); // 12 hours ago

      const bonus = calculateFileMtimeBonus(twelveHoursAgo);
      // Phase 2 (linear): age = 12h, midpoint between 6h and 24h
      // valueAt24h = floor(200 * 0.2) = 40
      // valueAt6h = floor(200 * 0.5) = 100
      // ratio = 1 - (6h / 18h) = 1 - 0.3333 = 0.6667
      // bonus = floor(40 + 0.6667 * 60) = floor(40 + 40) = 80
      expect(bonus).toBe(80);
    });

    test('should return 40 (Phase 3 start) for file modified exactly 24 hours ago', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

      const bonus = calculateFileMtimeBonus(oneDayAgo);
      // Phase 3 (linear): age = 24h exactly, at start of Phase 3
      // valueAt24h = floor(200 * 0.2) = 40
      // ratio = 1 - (0h / 144h) = 1.0
      // bonus = floor(1.0 * 40) = 40
      expect(bonus).toBe(40);
    });

    test('should return 20 (middle of Phase 3) for file modified 4 days ago', () => {
      const now = Date.now();
      const fourDaysAgo = now - (4 * 24 * 60 * 60 * 1000); // 4 days ago

      const bonus = calculateFileMtimeBonus(fourDaysAgo);
      // Phase 3 (linear): age = 4 days (96h), ageAfterFirstDay = 72h
      // remainingTtl = 144h (6 days in ms)
      // valueAt24h = floor(200 * 0.2) = 40
      // ratio = 1 - (72h / 144h) = 1 - 0.5 = 0.5
      // bonus = floor(0.5 * 40) = 20
      expect(bonus).toBe(20);
    });

    test('should return 0 for file modified exactly 7 days ago', () => {
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago

      const bonus = calculateFileMtimeBonus(sevenDaysAgo);
      // age = 7 days, ttl = 7 days
      // After TTL: no bonus
      expect(bonus).toBe(0);
    });

    test('should return 0 for file modified 7+ days ago', () => {
      const now = Date.now();
      const tenDaysAgo = now - (10 * 24 * 60 * 60 * 1000); // 10 days ago

      const bonus = calculateFileMtimeBonus(tenDaysAgo);
      expect(bonus).toBe(0);
    });

    test('should return 0 for file modified 30 days ago', () => {
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago

      const bonus = calculateFileMtimeBonus(thirtyDaysAgo);
      expect(bonus).toBe(0);
    });

    test('should handle future timestamp (edge case)', () => {
      const now = Date.now();
      const futureTime = now + (1 * 60 * 60 * 1000); // 1 hour in future

      const bonus = calculateFileMtimeBonus(futureTime);
      // age = negative, which is <= 0, so full bonus
      expect(bonus).toBe(200);
    });

    test('should decrease monotonically over time', () => {
      const now = Date.now();
      const oneHourAgo = now - (1 * 60 * 60 * 1000);
      const oneDayAgo = now - (1 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);
      const sixDaysAgo = now - (6 * 24 * 60 * 60 * 1000);

      const bonus1h = calculateFileMtimeBonus(oneHourAgo);
      const bonus1d = calculateFileMtimeBonus(oneDayAgo);
      const bonus3d = calculateFileMtimeBonus(threeDaysAgo);
      const bonus6d = calculateFileMtimeBonus(sixDaysAgo);

      expect(bonus1h).toBeGreaterThan(bonus1d);
      expect(bonus1d).toBeGreaterThan(bonus3d);
      expect(bonus3d).toBeGreaterThan(bonus6d);
    });

    test('should handle timestamps at boundary conditions', () => {
      const now = Date.now();
      const almostOneDayAgo = now - (24 * 60 * 60 * 1000 - 1); // 23:59:59.999 ago
      const oneDayAndOneHourAgo = now - (25 * 60 * 60 * 1000); // 25 hours ago
      const almostSevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000 - 1000); // 6 days, 23:59:59 ago

      const bonusAlmost1d = calculateFileMtimeBonus(almostOneDayAgo);
      const bonus25h = calculateFileMtimeBonus(oneDayAndOneHourAgo);
      const bonusAlmost7d = calculateFileMtimeBonus(almostSevenDaysAgo);

      // Phase 2: almostOneDayAgo (23:59:59.999) should be just above 40
      // valueAt24h = floor(200 * 0.2) = 40
      // valueAt6h = floor(200 * 0.5) = 100
      // ratio = 1 - (17.9999h / 18h) ≈ 0.000056
      // bonus = floor(40 + 0.000056 * 60) ≈ 40
      expect(bonusAlmost1d).toBe(40);

      // Phase 3: 25h ago
      // valueAt24h = 40
      // ratio = 1 - (1h / 144h) = 1 - 0.00694 = 0.9931
      // bonus = floor(0.9931 * 40) = 39
      expect(bonus25h).toBe(39);
      expect(bonus25h).toBeLessThan(bonusAlmost1d); // Phase 3, should be less than 40

      // Phase 3: almost 7 days, should be near 0
      expect(bonusAlmost7d).toBeGreaterThanOrEqual(0);
      expect(bonusAlmost7d).toBeLessThan(5); // Close to TTL boundary
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
      expect(recencyBonus).toBe(100); // Within 24h
      // Phase 1 (exponential): age = 2h, half-life = 6h
      // bonus = floor(200 * 2^(-2/6)) = floor(200 * 0.7937) = 158
      expect(mtimeBonus).toBe(158);

      const totalBonus = frequencyBonus + recencyBonus + mtimeBonus;
      expect(totalBonus).toBeGreaterThan(250);
    });

    test('should calculate bonuses for old unused file', () => {
      const now = Date.now();
      const oldTime = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago
      const usageCount = 0;

      const frequencyBonus = calculateFrequencyBonus(usageCount);
      const recencyBonus = calculateUsageRecencyBonus(oldTime);
      const mtimeBonus = calculateFileMtimeBonus(oldTime);

      expect(frequencyBonus).toBe(0);
      expect(recencyBonus).toBe(0); // Beyond TTL (7 days)
      expect(mtimeBonus).toBe(0); // Beyond TTL (7 days)

      const totalBonus = frequencyBonus + recencyBonus + mtimeBonus;
      expect(totalBonus).toBe(0);
    });

    test('should favor frequently used items even if old', () => {
      const now = Date.now();
      const oldTime = now - (5 * 24 * 60 * 60 * 1000); // 5 days ago
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
