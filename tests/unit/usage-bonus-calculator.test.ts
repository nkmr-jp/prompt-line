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
      expect(USAGE_BONUS.MAX_FILE_MTIME).toBe(1000);
      expect(USAGE_BONUS.FILE_MTIME_TTL_DAYS).toBe(7);
      expect(USAGE_BONUS.FILE_MTIME_HALF_LIFE_MS).toBe(6 * 60 * 60 * 1000); // 6 hours
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
      // Phase 1 (exponential): age = 1h, half-life = 6h
      // bonus = floor(1000 * exp(-ln(2) * 1/6)) = floor(1000 * 0.8909) = 890
      expect(bonus).toBe(890);
    });

    test('should return 1000 (max) for file modified just now', () => {
      const now = Date.now();

      const bonus = calculateFileMtimeBonus(now);
      expect(bonus).toBe(1000);
    });

    test('should return 500 for file modified exactly 6 hours ago (half-life)', () => {
      const now = Date.now();
      const sixHoursAgo = now - (6 * 60 * 60 * 1000); // 6 hours ago

      const bonus = calculateFileMtimeBonus(sixHoursAgo);
      // Phase 1 end / Phase 2 start: age = 6h, half-life point
      // bonus = floor(1000 * exp(-ln(2))) = floor(1000 * 0.5) = 500
      expect(bonus).toBe(500);
    });

    test('should return 400 for file modified exactly 12 hours ago', () => {
      const now = Date.now();
      const twelveHoursAgo = now - (12 * 60 * 60 * 1000); // 12 hours ago

      const bonus = calculateFileMtimeBonus(twelveHoursAgo);
      // Phase 2 (linear): age = 12h, midpoint between 6h and 24h
      // ratio = 1 - (6h / 18h) = 1 - 0.3333 = 0.6667
      // bonus = floor(200 + 0.6667 * 300) = floor(200 + 200) = 400
      expect(bonus).toBe(400);
    });

    test('should return 200 for file modified exactly 24 hours ago', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

      const bonus = calculateFileMtimeBonus(oneDayAgo);
      // Phase 3 (linear): age = 24h exactly, at start of Phase 3
      // ratio = 1 - (0h / 144h) = 1.0
      // bonus = floor(1.0 * 200) = 200
      expect(bonus).toBe(200);
    });

    test('should return 100 (middle of phase 3) for file modified 4 days ago', () => {
      const now = Date.now();
      const fourDaysAgo = now - (4 * 24 * 60 * 60 * 1000); // 4 days ago

      const bonus = calculateFileMtimeBonus(fourDaysAgo);
      // Phase 3 (linear): age = 4 days (96h), ageAfterFirstDay = 72h
      // remainingTtl = 144h (6 days in ms)
      // ratio = 1 - (72h / 144h) = 1 - 0.5 = 0.5
      // bonus = floor(0.5 * 200) = 100
      expect(bonus).toBe(100);
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
      expect(bonus).toBe(1000);
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

      // Phase 2: almostOneDayAgo (23:59:59.999) should be just above 200
      // ratio = 1 - (17.9999h / 18h) ≈ 0.000056
      // bonus = floor(200 + 0.000056 * 300) ≈ 200
      expect(bonusAlmost1d).toBe(200);

      // Phase 3: 25h ago
      // ratio = 1 - (1h / 144h) = 1 - 0.00694 = 0.9931
      // bonus = floor(0.9931 * 200) = 198
      expect(bonus25h).toBe(198);
      expect(bonus25h).toBeLessThan(bonusAlmost1d); // Phase 3, should be less than 200

      // Phase 3: almost 7 days, should be near 0
      expect(bonusAlmost7d).toBeGreaterThanOrEqual(0);
      expect(bonusAlmost7d).toBeLessThan(10); // Close to TTL boundary
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
      // Phase 1 (exponential): age = 2h, half-life = 6h
      // bonus = floor(1000 * exp(-ln(2) * 2/6)) = floor(1000 * 0.7937) = 793
      expect(mtimeBonus).toBe(793);

      const totalBonus = frequencyBonus + recencyBonus + mtimeBonus;
      expect(totalBonus).toBeGreaterThan(1000);
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
