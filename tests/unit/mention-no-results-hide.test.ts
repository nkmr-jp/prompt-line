import { describe, it, expect, beforeEach } from 'vitest';
import { splitKeywords } from '../../src/lib/keyword-utils';

/**
 * Test: When file search returns no results for a single keyword,
 * typing a space should close the mention popup.
 *
 * Root cause: splitKeywords("saa") and splitKeywords("saa ") both return ["saa"],
 * so the C3 optimization in checkForFileSearch skips the re-computation,
 * leaving the "No matching items found" popup visible.
 */
describe('mention no-results hide on space', () => {
  describe('splitKeywords trailing space behavior', () => {
    it('should return same keywords for "saa" and "saa " (current behavior)', () => {
      expect(splitKeywords('saa')).toEqual(['saa']);
      expect(splitKeywords('saa ')).toEqual(['saa']);
    });
  });

  describe('C3 keyword cache key should differentiate trailing space', () => {
    it('should produce different cache keys for queries with different space counts', () => {
      const queries = ['saa', 'saa ', 'saa  ', 'set ', 'set  '];

      // All queries with same keywords but different lengths should produce different keys
      const keys = queries.map(q => {
        const keywords = splitKeywords(q.toLowerCase());
        return keywords.join('\0') + '\0' + q.length;
      });

      // Each key should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('checkForFileSearch cache bypass scenario', () => {
    // Simulates the MentionManager.checkForFileSearch flow
    let lastFileSearchKeywords: string;
    let isVisible: boolean;
    let hideSuggestionsCalled: boolean;
    let handleFileSearchCalled: boolean;

    function buildCacheKey(query: string): string {
      const keywords = splitKeywords(query.toLowerCase());
      return keywords.join('\0') + '\0' + query.length;
    }

    function simulateCheckForFileSearch(query: string, merged: unknown[]): void {
      hideSuggestionsCalled = false;
      handleFileSearchCalled = false;

      const keywordsKey = buildCacheKey(query);
      if (keywordsKey === lastFileSearchKeywords && isVisible) {
        // Skip re-computation (C3 optimization)
        return;
      }
      lastFileSearchKeywords = keywordsKey;

      // Simulate handleFileSearch -> showSuggestions
      // Close mention based on space count and result count
      const spaceCount = query.split(' ').length - 1;
      if (spaceCount > 0) {
        if (spaceCount >= 2 || merged.length <= 1) {
          hideSuggestionsCalled = true;
          isVisible = false;
          return;
        }
      }

      handleFileSearchCalled = true;
      isVisible = merged.length > 0;
    }

    beforeEach(() => {
      lastFileSearchKeywords = '';
      isVisible = false;
      hideSuggestionsCalled = false;
      handleFileSearchCalled = false;
    });

    it('should call handleFileSearch for "saa" (single keyword, no results)', () => {
      simulateCheckForFileSearch('saa', []);
      expect(handleFileSearchCalled).toBe(true);
    });

    it('should NOT skip "saa " and should hide suggestions (trailing space, no results)', () => {
      // Step 1: type "saa" -> no results, shows "No matching items found"
      simulateCheckForFileSearch('saa', []);
      expect(handleFileSearchCalled).toBe(true);

      // Step 2: type space -> "saa " -> should NOT be skipped by cache
      simulateCheckForFileSearch('saa ', []);
      expect(hideSuggestionsCalled).toBe(true);
      expect(isVisible).toBe(false);
    });

    it('should hide suggestions when space typed after query with results', () => {
      // Step 1: type "setup" -> 1 result
      simulateCheckForFileSearch('setup', [{ name: 'setup.ts' }]);
      expect(handleFileSearchCalled).toBe(true);
      expect(isVisible).toBe(true);

      // Step 2: type space -> "setup " -> should close mention
      simulateCheckForFileSearch('setup ', [{ name: 'setup.ts' }]);
      expect(hideSuggestionsCalled).toBe(true);
      expect(isVisible).toBe(false);
    });

    it('should continue AND search when space typed with multiple results', () => {
      // Step 1: type "set" -> multiple results
      simulateCheckForFileSearch('set', [{ name: 'setup.ts' }, { name: 'settings.ts' }]);
      expect(handleFileSearchCalled).toBe(true);
      expect(isVisible).toBe(true);

      // Step 2: type space -> "set " -> should NOT close (AND search continues)
      simulateCheckForFileSearch('set ', [{ name: 'setup.ts' }, { name: 'settings.ts' }]);
      expect(hideSuggestionsCalled).toBe(false);
      expect(isVisible).toBe(true);
    });

    it('should always close when 2+ spaces regardless of result count', () => {
      // Step 1: type "set" -> multiple results
      simulateCheckForFileSearch('set', [{ name: 'setup.ts' }, { name: 'settings.ts' }]);
      expect(isVisible).toBe(true);

      // Step 2: type "set up" -> AND search continues (1 space, 2+ results)
      simulateCheckForFileSearch('set up', [{ name: 'setup.ts' }, { name: 'settings.ts' }]);
      expect(hideSuggestionsCalled).toBe(false);

      // Step 3: type "set up " -> 2 spaces -> always close
      simulateCheckForFileSearch('set up ', [{ name: 'setup.ts' }, { name: 'settings.ts' }]);
      expect(hideSuggestionsCalled).toBe(true);
      expect(isVisible).toBe(false);
    });

    it('should skip when keywords truly unchanged and visible', () => {
      // "test" with results -> visible
      simulateCheckForFileSearch('test', [{ name: 'test.ts' }]);
      expect(handleFileSearchCalled).toBe(true);
      expect(isVisible).toBe(true);

      // Same "test" again -> should skip (C3 optimization)
      simulateCheckForFileSearch('test', [{ name: 'test.ts' }]);
      expect(handleFileSearchCalled).toBe(false); // skipped
    });
  });
});
