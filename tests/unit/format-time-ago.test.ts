import { describe, test, expect } from '@jest/globals';
import { formatTimeAgo } from '../../src/utils/utils';

describe('formatTimeAgo', () => {
  test('should return "Just now" for timestamps less than a minute ago', () => {
    const now = Date.now();
    const timestamp = now - 30000; // 30 seconds ago
    expect(formatTimeAgo(timestamp)).toBe('Just now');
  });

  test('should return minutes for timestamps less than an hour ago', () => {
    const now = Date.now();
    const timestamp = now - 10 * 60000; // 10 minutes ago
    expect(formatTimeAgo(timestamp)).toBe('10m ago');
  });

  test('should return hours for timestamps less than a day ago', () => {
    const now = Date.now();
    const timestamp = now - 5 * 3600000; // 5 hours ago
    expect(formatTimeAgo(timestamp)).toBe('5h ago');
  });

  test('should return days for timestamps more than a day ago', () => {
    const now = Date.now();
    const timestamp = now - 3 * 86400000; // 3 days ago
    expect(formatTimeAgo(timestamp)).toBe('3d ago');
  });
});