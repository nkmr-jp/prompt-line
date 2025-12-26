/**
 * @jest-environment jsdom
 */
// @ts-nocheck


import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SettingsCacheManager } from '../../src/renderer/file-search/managers';

describe('SettingsCacheManager', () => {
  let settingsCacheManager: SettingsCacheManager;
  let mockElectronAPI: any;

  beforeEach(() => {
    // Create mock electronAPI
    mockElectronAPI = {
      mdSearch: {
        getMaxSuggestions: jest.fn(() => Promise.resolve(20)),
        getSearchPrefixes: jest.fn(() => Promise.resolve([] as string[]))
      },
      fileSearch: {
        getMaxSuggestions: jest.fn(() => Promise.resolve(20))
      }
    };

    // Set up window.electronAPI
    (window as any).electronAPI = mockElectronAPI;

    // Create SettingsCacheManager
    settingsCacheManager = new SettingsCacheManager();
  });

  afterEach(() => {
    // Clean up
    delete (window as any).electronAPI;
    jest.clearAllMocks();
  });

  describe('getMaxSuggestions', () => {
    test('should return cached value on second call', async () => {
      mockElectronAPI.mdSearch.getMaxSuggestions = jest.fn(() => Promise.resolve(30));

      const result1 = await settingsCacheManager.getMaxSuggestions('command');
      const result2 = await settingsCacheManager.getMaxSuggestions('command');

      expect(result1).toBe(30);
      expect(result2).toBe(30);
      expect(mockElectronAPI.mdSearch.getMaxSuggestions).toHaveBeenCalledTimes(1);
    });

    test('should call API separately for different types', async () => {
      let callCount = 0;
      mockElectronAPI.mdSearch.getMaxSuggestions = jest.fn(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? 30 : 25);
      });

      const commandResult = await settingsCacheManager.getMaxSuggestions('command');
      const mentionResult = await settingsCacheManager.getMaxSuggestions('mention');

      expect(commandResult).toBe(30);
      expect(mentionResult).toBe(25);
      expect(mockElectronAPI.mdSearch.getMaxSuggestions).toHaveBeenCalledTimes(2);
    });

    test('should return default value on API error', async () => {
      mockElectronAPI.mdSearch.getMaxSuggestions = jest.fn(() => Promise.reject(new Error('API error')));

      const result = await settingsCacheManager.getMaxSuggestions('command');

      expect(result).toBe(20); // DEFAULT_MAX_SUGGESTIONS
    });

    test('should return default value when electronAPI is not available', async () => {
      delete (window as any).electronAPI;

      const result = await settingsCacheManager.getMaxSuggestions('command');

      expect(result).toBe(20); // DEFAULT_MAX_SUGGESTIONS
    });
  });

  describe('clearMaxSuggestionsCache', () => {
    test('should clear the cache and fetch fresh values', async () => {
      let callCount = 0;
      mockElectronAPI.mdSearch.getMaxSuggestions = jest.fn(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? 30 : 35);
      });

      await settingsCacheManager.getMaxSuggestions('command');
      settingsCacheManager.clearMaxSuggestionsCache();
      const result = await settingsCacheManager.getMaxSuggestions('command');

      expect(result).toBe(35);
      expect(mockElectronAPI.mdSearch.getMaxSuggestions).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFileSearchMaxSuggestions', () => {
    test('should return cached value on second call', async () => {
      mockElectronAPI.fileSearch.getMaxSuggestions = jest.fn(() => Promise.resolve(50));

      const result1 = await settingsCacheManager.getFileSearchMaxSuggestions();
      const result2 = await settingsCacheManager.getFileSearchMaxSuggestions();

      expect(result1).toBe(50);
      expect(result2).toBe(50);
      expect(mockElectronAPI.fileSearch.getMaxSuggestions).toHaveBeenCalledTimes(1);
    });

    test('should return default value on API error', async () => {
      mockElectronAPI.fileSearch.getMaxSuggestions = jest.fn(() => Promise.reject(new Error('API error')));

      const result = await settingsCacheManager.getFileSearchMaxSuggestions();

      expect(result).toBe(20); // DEFAULT_MAX_SUGGESTIONS
    });
  });

  describe('getSearchPrefixes', () => {
    test('should return cached value on second call', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => Promise.resolve(['/prefix1', '/prefix2']));

      const result1 = await settingsCacheManager.getSearchPrefixes('command');
      const result2 = await settingsCacheManager.getSearchPrefixes('command');

      expect(result1).toEqual(['/prefix1', '/prefix2']);
      expect(result2).toEqual(['/prefix1', '/prefix2']);
      expect(mockElectronAPI.mdSearch.getSearchPrefixes).toHaveBeenCalledTimes(1);
    });

    test('should call API separately for different types', async () => {
      let callCount = 0;
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? ['/cmd1'] : ['@mention1']);
      });

      const commandResult = await settingsCacheManager.getSearchPrefixes('command');
      const mentionResult = await settingsCacheManager.getSearchPrefixes('mention');

      expect(commandResult).toEqual(['/cmd1']);
      expect(mentionResult).toEqual(['@mention1']);
      expect(mockElectronAPI.mdSearch.getSearchPrefixes).toHaveBeenCalledTimes(2);
    });

    test('should return empty array on API error', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => Promise.reject(new Error('API error')));

      const result = await settingsCacheManager.getSearchPrefixes('command');

      expect(result).toEqual([]);
    });
  });

  describe('clearSearchPrefixesCache', () => {
    test('should clear the cache and fetch fresh values', async () => {
      let callCount = 0;
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? ['/old'] : ['/new']);
      });

      await settingsCacheManager.getSearchPrefixes('command');
      settingsCacheManager.clearSearchPrefixesCache();
      const result = await settingsCacheManager.getSearchPrefixes('command');

      expect(result).toEqual(['/new']);
      expect(mockElectronAPI.mdSearch.getSearchPrefixes).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearAllCaches', () => {
    test('should clear all caches', async () => {
      let maxSuggestionsCallCount = 0;
      let prefixesCallCount = 0;
      let fileSearchCallCount = 0;

      mockElectronAPI.mdSearch.getMaxSuggestions = jest.fn(() => {
        maxSuggestionsCallCount++;
        return Promise.resolve(maxSuggestionsCallCount === 1 ? 30 : 35);
      });
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => {
        prefixesCallCount++;
        return Promise.resolve(prefixesCallCount === 1 ? ['/test'] : ['/new']);
      });
      mockElectronAPI.fileSearch.getMaxSuggestions = jest.fn(() => {
        fileSearchCallCount++;
        return Promise.resolve(fileSearchCallCount === 1 ? 50 : 55);
      });

      await settingsCacheManager.getMaxSuggestions('command');
      await settingsCacheManager.getSearchPrefixes('command');
      await settingsCacheManager.getFileSearchMaxSuggestions();

      settingsCacheManager.clearAllCaches();

      const maxSuggestions = await settingsCacheManager.getMaxSuggestions('command');
      const prefixes = await settingsCacheManager.getSearchPrefixes('command');
      const fileSearchMax = await settingsCacheManager.getFileSearchMaxSuggestions();

      expect(maxSuggestions).toBe(35);
      expect(prefixes).toEqual(['/new']);
      expect(fileSearchMax).toBe(55);
    });
  });

  describe('matchesSearchPrefix', () => {
    test('should return true when query matches a prefix', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => Promise.resolve(['/test', '/demo']));

      const result = await settingsCacheManager.matchesSearchPrefix('/test command', 'command');

      expect(result).toBe(true);
    });

    test('should return false when query does not match any prefix', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => Promise.resolve(['/test', '/demo']));

      const result = await settingsCacheManager.matchesSearchPrefix('no match', 'command');

      expect(result).toBe(false);
    });
  });

  describe('isCommandEnabledSync', () => {
    test('should return false when cache is empty', () => {
      const result = settingsCacheManager.isCommandEnabledSync();

      expect(result).toBe(false);
    });

    test('should return true when command prefixes are cached', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => Promise.resolve(['/cmd']));
      await settingsCacheManager.getSearchPrefixes('command');

      const result = settingsCacheManager.isCommandEnabledSync();

      expect(result).toBe(true);
    });

    test('should return false when command prefixes are empty', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => Promise.resolve([]));
      await settingsCacheManager.getSearchPrefixes('command');

      const result = settingsCacheManager.isCommandEnabledSync();

      expect(result).toBe(false);
    });
  });

  describe('matchesSearchPrefixSync', () => {
    test('should return false when cache is empty', () => {
      const result = settingsCacheManager.matchesSearchPrefixSync('/test', 'command');

      expect(result).toBe(false);
    });

    test('should return true when query matches cached prefix', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => Promise.resolve(['/test', '/demo']));
      await settingsCacheManager.getSearchPrefixes('command');

      const result = settingsCacheManager.matchesSearchPrefixSync('/test command', 'command');

      expect(result).toBe(true);
    });

    test('should return false when query does not match cached prefix', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => Promise.resolve(['/test', '/demo']));
      await settingsCacheManager.getSearchPrefixes('command');

      const result = settingsCacheManager.matchesSearchPrefixSync('no match', 'command');

      expect(result).toBe(false);
    });
  });

  describe('preloadSearchPrefixesCache', () => {
    test('should preload both command and mention prefixes', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn((type: string) => {
        if (type === 'command') {
          return Promise.resolve(['/cmd1']);
        } else {
          return Promise.resolve(['@mention1']);
        }
      });

      await settingsCacheManager.preloadSearchPrefixesCache();

      // Check that cache is populated by using sync methods
      const commandEnabled = settingsCacheManager.isCommandEnabledSync();
      const mentionMatches = settingsCacheManager.matchesSearchPrefixSync('@mention1 test', 'mention');

      expect(commandEnabled).toBe(true);
      expect(mentionMatches).toBe(true);
      expect(mockElectronAPI.mdSearch.getSearchPrefixes).toHaveBeenCalledWith('command');
      expect(mockElectronAPI.mdSearch.getSearchPrefixes).toHaveBeenCalledWith('mention');
    });

    test('should handle errors gracefully', async () => {
      mockElectronAPI.mdSearch.getSearchPrefixes = jest.fn(() => Promise.reject(new Error('API error')));

      await expect(settingsCacheManager.preloadSearchPrefixesCache()).resolves.not.toThrow();
    });
  });

  describe('getDefaultMaxSuggestions', () => {
    test('should return the default max suggestions value', () => {
      const result = settingsCacheManager.getDefaultMaxSuggestions();

      expect(result).toBe(20);
    });
  });
});
