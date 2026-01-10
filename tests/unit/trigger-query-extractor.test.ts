import { describe, test, expect } from '@jest/globals';
import { extractTriggerQueryAtCursor } from '../../src/renderer/utils/trigger-query-extractor';

describe('extractTriggerQueryAtCursor', () => {
  describe('slash command (/) tests', () => {
    test('should extract query from slash command at text start', () => {
      // '/comm' with cursor at position 5
      const result = extractTriggerQueryAtCursor('/comm', 5, '/');
      expect(result).toEqual({
        query: 'comm',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should extract query from slash command mid-text', () => {
      // 'hello /wo' with cursor at position 10
      const result = extractTriggerQueryAtCursor('hello /wo', 10, '/');
      expect(result).toEqual({
        query: 'wo',
        startPos: 6,
        triggerChar: '/'
      });
    });

    test('should extract query from slash command at line start', () => {
      // 'line1\n/co' with cursor at position 10
      const result = extractTriggerQueryAtCursor('line1\n/co', 10, '/');
      expect(result).toEqual({
        query: 'co',
        startPos: 6,
        triggerChar: '/'
      });
    });

    test('should extract query from slash command after tab', () => {
      // 'text\t/query' with cursor at position 11
      const result = extractTriggerQueryAtCursor('text\t/query', 11, '/');
      expect(result).toEqual({
        query: 'query',
        startPos: 5,
        triggerChar: '/'
      });
    });

    test('should not match slash in URL', () => {
      // 'https://example' with cursor at position 15
      const result = extractTriggerQueryAtCursor('https://example', 15, '/');
      expect(result).toBeNull();
    });

    test('should not match slash in file path', () => {
      // '/usr/local/bin' with cursor at position 14
      const result = extractTriggerQueryAtCursor('/usr/local/bin', 14, '/');
      expect(result).toBeNull();
    });
  });

  describe('at mention (@) tests', () => {
    test('should extract query from @ mention at text start', () => {
      // '@file' with cursor at position 5
      const result = extractTriggerQueryAtCursor('@file', 5, '@');
      expect(result).toEqual({
        query: 'file',
        startPos: 0,
        triggerChar: '@'
      });
    });

    test('should extract query from @ mention mid-text', () => {
      // 'hello @user' with cursor at position 11
      const result = extractTriggerQueryAtCursor('hello @user', 11, '@');
      expect(result).toEqual({
        query: 'user',
        startPos: 6,
        triggerChar: '@'
      });
    });

    test('should extract query from @ mention at line start', () => {
      // 'line1\n@mention' with cursor at position 14
      const result = extractTriggerQueryAtCursor('line1\n@mention', 14, '@');
      expect(result).toEqual({
        query: 'mention',
        startPos: 6,
        triggerChar: '@'
      });
    });

    test('should not match @ in email address', () => {
      // 'user@example.com' with cursor at position 16
      const result = extractTriggerQueryAtCursor('user@example.com', 16, '@');
      expect(result).toBeNull();
    });

    test('should not match @ in email domain', () => {
      // 'contact@company' with cursor at position 15
      const result = extractTriggerQueryAtCursor('contact@company', 15, '@');
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    test('should return null for empty text', () => {
      const result = extractTriggerQueryAtCursor('', 0, '/');
      expect(result).toBeNull();
    });

    test('should handle cursor at trigger character (empty query)', () => {
      // '/' with cursor at position 1
      const result = extractTriggerQueryAtCursor('/', 1, '/');
      expect(result).toEqual({
        query: '',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should handle cursor immediately after trigger character', () => {
      // 'text /' with cursor at position 6
      const result = extractTriggerQueryAtCursor('text /', 6, '/');
      expect(result).toEqual({
        query: '',
        startPos: 5,
        triggerChar: '/'
      });
    });

    test('should return null when trigger character not found', () => {
      // 'hello world' with cursor at position 11, looking for '/'
      const result = extractTriggerQueryAtCursor('hello world', 11, '/');
      expect(result).toBeNull();
    });

    test('should handle multiple trigger characters (use closest to cursor)', () => {
      // '/cmd1 /cmd2' with cursor at position 11
      const result = extractTriggerQueryAtCursor('/cmd1 /cmd2', 11, '/');
      expect(result).toEqual({
        query: 'cmd2',
        startPos: 6,
        triggerChar: '/'
      });
    });

    test('should handle trigger character after multiple spaces', () => {
      // 'text   /query' with cursor at position 13
      const result = extractTriggerQueryAtCursor('text   /query', 13, '/');
      expect(result).toEqual({
        query: 'query',
        startPos: 7,
        triggerChar: '/'
      });
    });

    test('should handle trigger character after multiple newlines', () => {
      // 'line1\n\n/cmd' with cursor at position 11
      const result = extractTriggerQueryAtCursor('line1\n\n/cmd', 11, '/');
      expect(result).toEqual({
        query: 'cmd',
        startPos: 7,
        triggerChar: '/'
      });
    });

    test('should stop at whitespace before finding trigger', () => {
      // 'text /cmd query' with cursor at position 15 (after 'query')
      const result = extractTriggerQueryAtCursor('text /cmd query', 15, '/');
      expect(result).toBeNull();
    });

    test('should handle cursor in middle of query', () => {
      // '/command' with cursor at position 4 (after '/comm')
      const result = extractTriggerQueryAtCursor('/command', 4, '/');
      expect(result).toEqual({
        query: 'com',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should handle tab character before trigger', () => {
      // '\t@mention' with cursor at position 9
      const result = extractTriggerQueryAtCursor('\t@mention', 9, '@');
      expect(result).toEqual({
        query: 'mention',
        startPos: 1,
        triggerChar: '@'
      });
    });

    test('should handle newline before trigger', () => {
      // '\n/slash' with cursor at position 7
      const result = extractTriggerQueryAtCursor('\n/slash', 7, '/');
      expect(result).toEqual({
        query: 'slash',
        startPos: 1,
        triggerChar: '/'
      });
    });
  });

  describe('cursor position boundary tests', () => {
    test('should handle cursor at position 0', () => {
      const result = extractTriggerQueryAtCursor('/command', 0, '/');
      expect(result).toBeNull();
    });

    test('should handle cursor at end of text', () => {
      // '/command' with cursor at position 8 (end)
      const result = extractTriggerQueryAtCursor('/command', 8, '/');
      expect(result).toEqual({
        query: 'command',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should handle cursor beyond text length (edge case)', () => {
      // '/cmd' with cursor at position 10 (beyond end)
      const result = extractTriggerQueryAtCursor('/cmd', 10, '/');
      expect(result).toEqual({
        query: 'cmd',
        startPos: 0,
        triggerChar: '/'
      });
    });
  });

  describe('whitespace handling', () => {
    test('should stop at space character', () => {
      // 'before /query after' with cursor at position 18 (after 'after')
      const result = extractTriggerQueryAtCursor('before /query after', 18, '/');
      expect(result).toBeNull();
    });

    test('should stop at newline character', () => {
      // '/query\nafter' with cursor at position 12 (after 'after')
      const result = extractTriggerQueryAtCursor('/query\nafter', 12, '/');
      expect(result).toBeNull();
    });

    test('should stop at tab character', () => {
      // '/query\tafter' with cursor at position 12 (after 'after')
      const result = extractTriggerQueryAtCursor('/query\tafter', 12, '/');
      expect(result).toBeNull();
    });

    test('should allow trigger after space', () => {
      // ' /query' with cursor at position 7
      const result = extractTriggerQueryAtCursor(' /query', 7, '/');
      expect(result).toEqual({
        query: 'query',
        startPos: 1,
        triggerChar: '/'
      });
    });

    test('should allow trigger after newline', () => {
      // '\n@mention' with cursor at position 9
      const result = extractTriggerQueryAtCursor('\n@mention', 9, '@');
      expect(result).toEqual({
        query: 'mention',
        startPos: 1,
        triggerChar: '@'
      });
    });

    test('should allow trigger after tab', () => {
      // '\t/command' with cursor at position 9
      const result = extractTriggerQueryAtCursor('\t/command', 9, '/');
      expect(result).toEqual({
        query: 'command',
        startPos: 1,
        triggerChar: '/'
      });
    });
  });

  describe('real-world usage scenarios', () => {
    test('should extract slash command in sentence', () => {
      // 'I want to use /help command' with cursor at position 19
      const result = extractTriggerQueryAtCursor('I want to use /help command', 19, '/');
      expect(result).toEqual({
        query: 'help',
        startPos: 14,
        triggerChar: '/'
      });
    });

    test('should extract @ mention in sentence', () => {
      // 'Please notify @john about this' with cursor at position 19
      const result = extractTriggerQueryAtCursor('Please notify @john about this', 19, '@');
      expect(result).toEqual({
        query: 'john',
        startPos: 14,
        triggerChar: '@'
      });
    });

    test('should handle code snippet with slash', () => {
      // 'cd /home/user' with cursor at position 13
      const result = extractTriggerQueryAtCursor('cd /home/user', 13, '/');
      expect(result).toBeNull();
    });

    test('should handle multiple @ mentions (use closest)', () => {
      // 'From @alice to @bob' with cursor at position 19
      const result = extractTriggerQueryAtCursor('From @alice to @bob', 19, '@');
      expect(result).toEqual({
        query: 'bob',
        startPos: 15,
        triggerChar: '@'
      });
    });

    test('should handle slash command at document start', () => {
      // '/start' with cursor at position 6
      const result = extractTriggerQueryAtCursor('/start', 6, '/');
      expect(result).toEqual({
        query: 'start',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should handle @ mention after punctuation and space', () => {
      // 'Hello. @user' with cursor at position 12
      const result = extractTriggerQueryAtCursor('Hello. @user', 12, '@');
      // Space before @ makes it valid, even after punctuation
      expect(result).toEqual({
        query: 'user',
        startPos: 7,
        triggerChar: '@'
      });
    });

    test('should handle @ mention after comma + space', () => {
      // 'Hello, @user' with cursor at position 12
      const result = extractTriggerQueryAtCursor('Hello, @user', 12, '@');
      // Space before @ makes it valid, even after punctuation
      expect(result).toEqual({
        query: 'user',
        startPos: 7,
        triggerChar: '@'
      });
    });

    test('should not match @ directly after punctuation (no space)', () => {
      // 'email.@user' with cursor at position 11
      const result = extractTriggerQueryAtCursor('email.@user', 11, '@');
      expect(result).toBeNull(); // Dot directly before @, no whitespace
    });

    test('should not match / directly after punctuation (no space)', () => {
      // 'url./path' with cursor at position 9
      const result = extractTriggerQueryAtCursor('url./path', 9, '/');
      expect(result).toBeNull(); // Dot directly before /, no whitespace
    });

    test('should handle trigger with Unicode characters', () => {
      // '/命令' with cursor at position 3
      const result = extractTriggerQueryAtCursor('/命令', 3, '/');
      expect(result).toEqual({
        query: '命令',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should handle trigger with emoji in query', () => {
      // '@user😀' with cursor at position 7
      const result = extractTriggerQueryAtCursor('@user😀', 7, '@');
      expect(result).toEqual({
        query: 'user😀',
        startPos: 0,
        triggerChar: '@'
      });
    });
  });

  describe('different trigger characters', () => {
    test('should work with / trigger', () => {
      const result = extractTriggerQueryAtCursor('/cmd', 4, '/');
      expect(result).toEqual({
        query: 'cmd',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should work with @ trigger', () => {
      const result = extractTriggerQueryAtCursor('@user', 5, '@');
      expect(result).toEqual({
        query: 'user',
        startPos: 0,
        triggerChar: '@'
      });
    });

    test('should work with # trigger', () => {
      const result = extractTriggerQueryAtCursor('#tag', 4, '#');
      expect(result).toEqual({
        query: 'tag',
        startPos: 0,
        triggerChar: '#'
      });
    });

    test('should only find specified trigger character', () => {
      // Text has both / and @, but we're looking for /
      const result = extractTriggerQueryAtCursor('@user /cmd', 10, '/');
      expect(result).toEqual({
        query: 'cmd',
        startPos: 6,
        triggerChar: '/'
      });
    });

    test('should not confuse different trigger characters', () => {
      // Text has /, but we're looking for @
      const result = extractTriggerQueryAtCursor('/command', 8, '@');
      expect(result).toBeNull();
    });
  });

  describe('performance and special cases', () => {
    test('should handle very long text efficiently', () => {
      const longText = 'a'.repeat(10000) + ' /query';
      const result = extractTriggerQueryAtCursor(longText, longText.length, '/');
      expect(result).toEqual({
        query: 'query',
        startPos: 10001,
        triggerChar: '/'
      });
    });

    test('should handle text with many trigger characters', () => {
      const text = '/ / / / /query';
      const result = extractTriggerQueryAtCursor(text, text.length, '/');
      expect(result).toEqual({
        query: 'query',
        startPos: 8,
        triggerChar: '/'
      });
    });

    test('should handle special regex characters in query', () => {
      // '/test.file' with cursor at position 10
      const result = extractTriggerQueryAtCursor('/test.file', 10, '/');
      expect(result).toEqual({
        query: 'test.file',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should handle backslash in text', () => {
      // 'path\\file /cmd' with cursor at position 14
      const result = extractTriggerQueryAtCursor('path\\file /cmd', 14, '/');
      expect(result).toEqual({
        query: 'cmd',
        startPos: 10,
        triggerChar: '/'
      });
    });

    test('should handle query with numbers', () => {
      // '/cmd123' with cursor at position 7
      const result = extractTriggerQueryAtCursor('/cmd123', 7, '/');
      expect(result).toEqual({
        query: 'cmd123',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should handle query with hyphens', () => {
      // '/my-command' with cursor at position 11
      const result = extractTriggerQueryAtCursor('/my-command', 11, '/');
      expect(result).toEqual({
        query: 'my-command',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('should handle query with underscores', () => {
      // '@user_name' with cursor at position 10
      const result = extractTriggerQueryAtCursor('@user_name', 10, '@');
      expect(result).toEqual({
        query: 'user_name',
        startPos: 0,
        triggerChar: '@'
      });
    });
  });

  describe('specification compliance tests', () => {
    test('[SPEC] should extract query from / at start', () => {
      // Test case from specification: '/comm' (cursor=5)
      const result = extractTriggerQueryAtCursor('/comm', 5, '/');
      expect(result).toEqual({
        query: 'comm',
        startPos: 0,
        triggerChar: '/'
      });
    });

    test('[SPEC] should extract query from / mid-text', () => {
      // Test case from specification: 'hello /wo' (cursor=10)
      const result = extractTriggerQueryAtCursor('hello /wo', 10, '/');
      expect(result).toEqual({
        query: 'wo',
        startPos: 6,
        triggerChar: '/'
      });
    });

    test('[SPEC] should extract query from / at line start', () => {
      // Test case from specification: 'line1\n/co' (cursor=10)
      const result = extractTriggerQueryAtCursor('line1\n/co', 10, '/');
      expect(result).toEqual({
        query: 'co',
        startPos: 6,
        triggerChar: '/'
      });
    });

    test('[SPEC] should extract query from @ trigger', () => {
      // Test case from specification: '@file' (cursor=5)
      const result = extractTriggerQueryAtCursor('@file', 5, '@');
      expect(result).toEqual({
        query: 'file',
        startPos: 0,
        triggerChar: '@'
      });
    });

    test('[SPEC] should return null when no trigger', () => {
      // Test case from specification: 'hello' (cursor=5)
      const result = extractTriggerQueryAtCursor('hello', 5, '/');
      expect(result).toBeNull();
    });

    test('[SPEC] should return null for email @ character', () => {
      // Test case from specification: 'user@example' (cursor=12)
      const result = extractTriggerQueryAtCursor('user@example', 12, '@');
      expect(result).toBeNull();
    });
  });
});
