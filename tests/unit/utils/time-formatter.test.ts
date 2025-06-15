import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { formatTime } from '../../../src/renderer/utils/time-formatter';

describe('formatTime', () => {
  let originalDateNow: () => number;

  beforeEach(() => {
    originalDateNow = Date.now;
    // Set a fixed timestamp for consistent testing
    Date.now = jest.fn(() => 1000000000000); // Fixed timestamp
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  test('should return "Just now" for timestamps less than 1 minute ago', () => {
    const timestamp = 1000000000000 - 30 * 1000; // 30 seconds ago
    
    expect(formatTime(timestamp)).toBe('Just now');
  });

  test('should return minutes for timestamps less than 1 hour ago', () => {
    const timestamp = 1000000000000 - 5 * 60 * 1000; // 5 minutes ago
    
    expect(formatTime(timestamp)).toBe('5m ago');
  });

  test('should return hours for timestamps less than 24 hours ago', () => {
    const timestamp = 1000000000000 - 3 * 60 * 60 * 1000; // 3 hours ago
    
    expect(formatTime(timestamp)).toBe('3h ago');
  });

  test('should return days for timestamps 24 hours or more ago', () => {
    const timestamp = 1000000000000 - 2 * 24 * 60 * 60 * 1000; // 2 days ago
    
    expect(formatTime(timestamp)).toBe('2d ago');
  });

  test('should handle edge case of exactly 1 minute', () => {
    const timestamp = 1000000000000 - 60 * 1000; // exactly 1 minute ago
    
    expect(formatTime(timestamp)).toBe('1m ago');
  });

  test('should handle edge case of exactly 1 hour', () => {
    const timestamp = 1000000000000 - 60 * 60 * 1000; // exactly 1 hour ago
    
    expect(formatTime(timestamp)).toBe('1h ago');
  });

  test('should handle edge case of exactly 24 hours', () => {
    const timestamp = 1000000000000 - 24 * 60 * 60 * 1000; // exactly 24 hours ago
    
    expect(formatTime(timestamp)).toBe('1d ago');
  });

  test('should handle future timestamps', () => {
    const timestamp = 1000000000000 + 60 * 1000; // 1 minute in the future
    
    expect(formatTime(timestamp)).toBe('Just now');
  });

  test('should handle very old timestamps', () => {
    const timestamp = 1000000000000 - 365 * 24 * 60 * 60 * 1000; // 1 year ago
    
    expect(formatTime(timestamp)).toBe('365d ago');
  });
});