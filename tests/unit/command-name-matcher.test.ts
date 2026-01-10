import { describe, test, expect } from '@jest/globals';
import { matchCommandName, isCommandEnabled } from '../../src/lib/command-name-matcher';

describe('command-name-matcher', () => {
  describe('matchCommandName', () => {
    describe('exact match', () => {
      test('should return true when pattern and command name are identical', () => {
        expect(matchCommandName('commit', 'commit')).toBe(true);
      });

      test('should return false when pattern and command name are different', () => {
        expect(matchCommandName('commit', 'commit2')).toBe(false);
      });

      test('should return false when pattern is shorter than command name', () => {
        expect(matchCommandName('test', 'testing')).toBe(false);
      });

      test('should return false when pattern is longer than command name', () => {
        expect(matchCommandName('testing', 'test')).toBe(false);
      });

      test('should handle case-sensitive matching', () => {
        expect(matchCommandName('Commit', 'commit')).toBe(false);
        expect(matchCommandName('commit', 'Commit')).toBe(false);
      });

      test('should handle special characters in exact match', () => {
        expect(matchCommandName('sa:test', 'sa:test')).toBe(true);
        expect(matchCommandName('ralph-loop:start', 'ralph-loop:start')).toBe(true);
      });

      test('should handle empty strings', () => {
        expect(matchCommandName('', '')).toBe(true);
        expect(matchCommandName('', 'test')).toBe(false);
        expect(matchCommandName('test', '')).toBe(false);
      });
    });

    describe('prefix match', () => {
      test('should return true when command name starts with pattern prefix', () => {
        expect(matchCommandName('ralph-loop:*', 'ralph-loop:start')).toBe(true);
        expect(matchCommandName('ralph-loop:*', 'ralph-loop:stop')).toBe(true);
        expect(matchCommandName('ralph-loop:*', 'ralph-loop:cancel')).toBe(true);
      });

      test('should return false when command name does not start with pattern prefix', () => {
        expect(matchCommandName('ralph-loop:*', 'other:start')).toBe(false);
        expect(matchCommandName('ralph-loop:*', 'commit')).toBe(false);
      });

      test('should handle wildcard-only pattern', () => {
        expect(matchCommandName('*', 'any-command')).toBe(true);
        expect(matchCommandName('*', 'commit')).toBe(true);
        expect(matchCommandName('*', '')).toBe(true);
      });

      test('should handle empty prefix before wildcard', () => {
        expect(matchCommandName('*', 'test')).toBe(true);
      });

      test('should handle case-sensitive prefix matching', () => {
        expect(matchCommandName('sa:*', 'sa:test')).toBe(true);
        expect(matchCommandName('sa:*', 'SA:test')).toBe(false);
        expect(matchCommandName('SA:*', 'sa:test')).toBe(false);
      });

      test('should return true when command name equals prefix (without wildcard)', () => {
        expect(matchCommandName('ralph-loop:*', 'ralph-loop:')).toBe(true);
      });

      test('should handle multiple wildcards in pattern (only last one matters)', () => {
        // Note: This tests current implementation behavior where only the last '*' matters
        // Pattern 'test*pattern*' has prefix 'test*pattern' (the '*' in the middle is treated as literal)
        expect(matchCommandName('test*pattern*', 'test*pattern*anything')).toBe(true);
        expect(matchCommandName('test*pattern*', 'test*pattern')).toBe(true);
      });

      test('should handle special characters in prefix', () => {
        expect(matchCommandName('skill:*', 'skill:test')).toBe(true);
        expect(matchCommandName('example-skills:*', 'example-skills:pdf')).toBe(true);
      });
    });

    describe('edge cases', () => {
      test('should handle pattern with only wildcard', () => {
        expect(matchCommandName('*', 'anything')).toBe(true);
      });

      test('should handle command name with wildcard character', () => {
        // Pattern 'test*' has prefix 'test', so command 'test*' matches (starts with 'test')
        expect(matchCommandName('test*', 'test*')).toBe(true);
        expect(matchCommandName('test*', 'test*command')).toBe(true);
      });

      test('should handle unicode characters', () => {
        expect(matchCommandName('テスト', 'テスト')).toBe(true);
        expect(matchCommandName('テスト*', 'テストコマンド')).toBe(true);
        expect(matchCommandName('テスト*', '別のコマンド')).toBe(false);
      });
    });
  });

  describe('isCommandEnabled', () => {
    describe('no enable or disable lists', () => {
      test('should return true when both lists are undefined', () => {
        expect(isCommandEnabled('commit')).toBe(true);
      });

      test('should return true when both lists are empty arrays', () => {
        expect(isCommandEnabled('commit', [], [])).toBe(true);
      });

      test('should return true when enable is undefined and disable is empty', () => {
        expect(isCommandEnabled('commit', undefined, [])).toBe(true);
      });

      test('should return true when enable is empty and disable is undefined', () => {
        expect(isCommandEnabled('commit', [], undefined)).toBe(true);
      });
    });

    describe('enable list only', () => {
      test('should return true when command matches enable pattern', () => {
        expect(isCommandEnabled('commit', ['commit'])).toBe(true);
      });

      test('should return false when command does not match enable pattern', () => {
        expect(isCommandEnabled('commit', ['test'])).toBe(false);
      });

      test('should return true when command matches one of multiple enable patterns', () => {
        expect(isCommandEnabled('commit', ['test', 'commit', 'other'])).toBe(true);
      });

      test('should return false when command matches none of enable patterns', () => {
        expect(isCommandEnabled('commit', ['test', 'other'])).toBe(false);
      });

      test('should support wildcard patterns in enable list', () => {
        expect(isCommandEnabled('ralph-loop:start', ['ralph-loop:*'])).toBe(true);
        expect(isCommandEnabled('ralph-loop:stop', ['ralph-loop:*'])).toBe(true);
        expect(isCommandEnabled('other:start', ['ralph-loop:*'])).toBe(false);
      });

      test('should support wildcard-only pattern in enable list', () => {
        expect(isCommandEnabled('any-command', ['*'])).toBe(true);
      });

      test('should support mix of exact and wildcard patterns in enable list', () => {
        expect(isCommandEnabled('commit', ['commit', 'sa:*'])).toBe(true);
        expect(isCommandEnabled('sa:test', ['commit', 'sa:*'])).toBe(true);
        expect(isCommandEnabled('other', ['commit', 'sa:*'])).toBe(false);
      });
    });

    describe('disable list only', () => {
      test('should return false when command matches disable pattern', () => {
        expect(isCommandEnabled('commit', undefined, ['commit'])).toBe(false);
      });

      test('should return true when command does not match disable pattern', () => {
        expect(isCommandEnabled('commit', undefined, ['test'])).toBe(true);
      });

      test('should return false when command matches one of multiple disable patterns', () => {
        expect(isCommandEnabled('commit', undefined, ['test', 'commit', 'other'])).toBe(false);
      });

      test('should return true when command matches none of disable patterns', () => {
        expect(isCommandEnabled('commit', undefined, ['test', 'other'])).toBe(true);
      });

      test('should support wildcard patterns in disable list', () => {
        expect(isCommandEnabled('ralph-loop:start', undefined, ['ralph-loop:*'])).toBe(false);
        expect(isCommandEnabled('ralph-loop:stop', undefined, ['ralph-loop:*'])).toBe(false);
        expect(isCommandEnabled('other:start', undefined, ['ralph-loop:*'])).toBe(true);
      });

      test('should support wildcard-only pattern in disable list', () => {
        expect(isCommandEnabled('any-command', undefined, ['*'])).toBe(false);
      });

      test('should support mix of exact and wildcard patterns in disable list', () => {
        expect(isCommandEnabled('commit', undefined, ['commit', 'sa:*'])).toBe(false);
        expect(isCommandEnabled('sa:test', undefined, ['commit', 'sa:*'])).toBe(false);
        expect(isCommandEnabled('other', undefined, ['commit', 'sa:*'])).toBe(true);
      });
    });

    describe('both enable and disable lists', () => {
      test('should return true when command matches enable and does not match disable', () => {
        expect(isCommandEnabled('commit', ['commit'], ['test'])).toBe(true);
      });

      test('should return false when command matches both enable and disable', () => {
        expect(isCommandEnabled('commit', ['commit'], ['commit'])).toBe(false);
      });

      test('should return false when command does not match enable', () => {
        expect(isCommandEnabled('commit', ['test'], ['other'])).toBe(false);
      });

      test('should return false when command does not match enable (even if also not disabled)', () => {
        expect(isCommandEnabled('commit', ['test'], ['other'])).toBe(false);
      });

      test('should handle wildcard patterns in both lists', () => {
        // Enable all ralph-loop commands, but disable ralph-loop:cancel
        expect(isCommandEnabled('ralph-loop:start', ['ralph-loop:*'], ['ralph-loop:cancel'])).toBe(true);
        expect(isCommandEnabled('ralph-loop:stop', ['ralph-loop:*'], ['ralph-loop:cancel'])).toBe(true);
        expect(isCommandEnabled('ralph-loop:cancel', ['ralph-loop:*'], ['ralph-loop:cancel'])).toBe(false);
      });

      test('should prioritize disable over enable when both match', () => {
        expect(isCommandEnabled('test', ['*'], ['test'])).toBe(false);
        expect(isCommandEnabled('test', ['test'], ['*'])).toBe(false);
      });

      test('should handle complex patterns', () => {
        const enable = ['sa:*', 'commit', 'example-skills:*'];
        const disable = ['sa:debug', 'example-skills:brand-guidelines'];

        expect(isCommandEnabled('sa:test', enable, disable)).toBe(true);
        expect(isCommandEnabled('sa:debug', enable, disable)).toBe(false);
        expect(isCommandEnabled('commit', enable, disable)).toBe(true);
        expect(isCommandEnabled('example-skills:pdf', enable, disable)).toBe(true);
        expect(isCommandEnabled('example-skills:brand-guidelines', enable, disable)).toBe(false);
        expect(isCommandEnabled('other', enable, disable)).toBe(false);
      });
    });

    describe('edge cases', () => {
      test('should handle empty command name', () => {
        expect(isCommandEnabled('')).toBe(true);
        expect(isCommandEnabled('', [''])).toBe(true);
        expect(isCommandEnabled('', ['*'])).toBe(true);
        expect(isCommandEnabled('', undefined, [''])).toBe(false);
      });

      test('should handle empty pattern in lists', () => {
        expect(isCommandEnabled('test', [''])).toBe(false);
        expect(isCommandEnabled('', [''])).toBe(true);
      });

      test('should handle case sensitivity', () => {
        expect(isCommandEnabled('Commit', ['commit'])).toBe(false);
        expect(isCommandEnabled('commit', ['Commit'])).toBe(false);
      });

      test('should handle special characters', () => {
        expect(isCommandEnabled('skill:edit', ['skill:*'])).toBe(true);
        expect(isCommandEnabled('ralph-loop:ralph-loop', ['ralph-loop:*'])).toBe(true);
      });

      test('should handle unicode characters', () => {
        expect(isCommandEnabled('テスト', ['テスト'])).toBe(true);
        expect(isCommandEnabled('テストコマンド', ['テスト*'])).toBe(true);
      });
    });
  });
});
