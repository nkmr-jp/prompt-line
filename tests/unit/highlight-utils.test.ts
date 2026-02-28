// @vitest-environment jsdom
import { highlightMatch } from '../../src/renderer/utils/highlight-utils';

describe('highlightMatch', () => {
  describe('single keyword', () => {
    test('should highlight matching text', () => {
      const result = highlightMatch('Hello World', 'wor', 'hl');
      expect(result).toBe('Hello <span class="hl">Wor</span>ld');
    });

    test('should return escaped text when query is empty', () => {
      const result = highlightMatch('Hello <World>', '');
      expect(result).toBe('Hello &lt;World&gt;');
    });

    test('should escape HTML in text', () => {
      const result = highlightMatch('<script>alert("xss")</script>', 'script', 'hl');
      expect(result).toContain('&lt;');
      expect(result).not.toContain('<script>');
    });

    test('should highlight case-insensitively', () => {
      const result = highlightMatch('TypeScript', 'type', 'hl');
      expect(result).toBe('<span class="hl">Type</span>Script');
    });
  });

  describe('multiple keywords (space-separated)', () => {
    test('should highlight multiple keywords', () => {
      const result = highlightMatch('Claude Code Model', 'claude model', 'hl');
      expect(result).toBe(
        '<span class="hl">Claude</span> Code <span class="hl">Model</span>'
      );
    });

    test('should handle query with extra spaces', () => {
      const result = highlightMatch('Hello World', '  hello   world  ', 'hl');
      expect(result).toBe(
        '<span class="hl">Hello</span> <span class="hl">World</span>'
      );
    });
  });
});
