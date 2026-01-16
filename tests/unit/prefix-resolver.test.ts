import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Unmock path module for this test (we need real path functions)
jest.unmock('path');

// Mock glob before importing prefix-resolver
jest.mock('glob', () => ({
  glob: jest.fn()
}));

// Import after mocks
import {
  parsePrefixPattern,
  resolvePrefix,
  clearPrefixCache
} from '../../src/lib/prefix-resolver';
import { glob } from 'glob';

const mockedGlob = jest.mocked(glob);

describe('prefix-resolver', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prefix-resolver-test-'));
    jest.clearAllMocks();
    clearPrefixCache();
  });

  afterEach(() => {
    // Clean up the temporary directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('parsePrefixPattern', () => {
    test('should parse valid pattern with single @ separator', () => {
      const pattern = '**/.claude-plugin/plugin.json@name';
      const result = parsePrefixPattern(pattern);

      expect(result).toEqual({
        globPattern: '**/.claude-plugin/plugin.json',
        fieldPath: 'name'
      });
    });

    test('should parse pattern with nested field path', () => {
      const pattern = 'config.json@metadata.name';
      const result = parsePrefixPattern(pattern);

      expect(result).toEqual({
        globPattern: 'config.json',
        fieldPath: 'metadata.name'
      });
    });

    test('should parse pattern with deeply nested field path', () => {
      const pattern = 'package.json@workspace.config.name';
      const result = parsePrefixPattern(pattern);

      expect(result).toEqual({
        globPattern: 'package.json',
        fieldPath: 'workspace.config.name'
      });
    });

    test('should use last @ as separator when multiple @ exist', () => {
      const pattern = 'path/@scope/package.json@name';
      const result = parsePrefixPattern(pattern);

      expect(result).toEqual({
        globPattern: 'path/@scope/package.json',
        fieldPath: 'name'
      });
    });

    test('should return null when @ is not present', () => {
      const pattern = '**/.claude-plugin/plugin.json';
      const result = parsePrefixPattern(pattern);

      expect(result).toBeNull();
    });

    test('should return null for empty string', () => {
      const pattern = '';
      const result = parsePrefixPattern(pattern);

      expect(result).toBeNull();
    });

    test('should handle pattern with @ at the end', () => {
      const pattern = 'config.json@';
      const result = parsePrefixPattern(pattern);

      expect(result).toEqual({
        globPattern: 'config.json',
        fieldPath: ''
      });
    });

    test('should handle pattern with @ at the start', () => {
      const pattern = '@fieldPath';
      const result = parsePrefixPattern(pattern);

      expect(result).toEqual({
        globPattern: '',
        fieldPath: 'fieldPath'
      });
    });
  });

  describe('resolvePrefix', () => {
    test('should return empty string when pattern has no @ separator', async () => {
      const commandFilePath = path.join(testDir, 'commands', 'test.md');
      const result = await resolvePrefix(commandFilePath, 'invalid-pattern', testDir);

      expect(result).toBe('');
      expect(mockedGlob).not.toHaveBeenCalled();
    });

    test('should retrieve value from JSON file', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });

      // Create JSON file
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({ name: 'test-prefix' }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );

      expect(result).toBe('test-prefix');
      expect(mockedGlob).toHaveBeenCalled();
    });

    test('should retrieve nested field value from JSON file', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });

      // Create JSON file with nested structure
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({
        metadata: {
          name: 'nested-prefix',
          version: '1.0.0'
        }
      }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@metadata.name',
        testDir
      );

      expect(result).toBe('nested-prefix');
    });

    test('should retrieve deeply nested field value', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });

      // Create JSON file with deeply nested structure
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({
        workspace: {
          config: {
            project: {
              name: 'deep-prefix'
            }
          }
        }
      }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@workspace.config.project.name',
        testDir
      );

      expect(result).toBe('deep-prefix');
    });

    test('should return empty string when JSON file is not found', async () => {
      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return no matches
      mockedGlob.mockResolvedValue([]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );

      expect(result).toBe('');
    });

    test('should return empty string when field does not exist', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });

      // Create JSON file without the requested field
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({ version: '1.0.0' }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );

      expect(result).toBe('');
    });

    test('should return empty string when field value is not a string', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });

      // Create JSON file with non-string value
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({
        name: { nested: 'value' },
        count: 123,
        enabled: true
      }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      // Test with object value
      let result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );
      expect(result).toBe('');

      // Clear cache for next test
      clearPrefixCache();

      // Test with number value
      result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@count',
        testDir
      );
      expect(result).toBe('');

      clearPrefixCache();

      // Test with boolean value
      result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@enabled',
        testDir
      );
      expect(result).toBe('');
    });

    test('should return empty string when JSON is invalid', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });

      // Create invalid JSON file
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, '{ invalid json }');

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );

      expect(result).toBe('');
    });

    test('should search parent directories when file is not found in command directory', async () => {
      // Create directory structure: testDir/.config/plugin.json
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({ name: 'root-prefix' }));

      // Create nested command file: testDir/commands/nested/test.md
      const nestedDir = path.join(testDir, 'commands', 'nested');
      fs.mkdirSync(nestedDir, { recursive: true });
      const commandFilePath = path.join(nestedDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return no matches first, then the config file
      let callCount = 0;
      (mockedGlob as any).mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          // First two calls (nested and commands dirs) return no matches
          return [];
        } else {
          // Third call (testDir) returns the config file
          return [configFile];
        }
      });

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );

      expect(result).toBe('root-prefix');
      expect(mockedGlob).toHaveBeenCalledTimes(3); // nested, commands, testDir
    });

    test('should stop search at base path', async () => {
      // Create nested directory structure outside testDir
      const outerDir = path.join(os.tmpdir(), 'outer-test-dir');
      fs.mkdirSync(outerDir, { recursive: true });

      try {
        // Create base path directory
        const basePath = path.join(outerDir, 'base');
        fs.mkdirSync(basePath, { recursive: true });

        // Create command in nested directory
        const commandsDir = path.join(basePath, 'commands');
        fs.mkdirSync(commandsDir, { recursive: true });
        const commandFilePath = path.join(commandsDir, 'test.md');
        fs.writeFileSync(commandFilePath, '# Test Command');

        // Mock glob to always return no matches
        mockedGlob.mockResolvedValue([]);

        const result = await resolvePrefix(
          commandFilePath,
          '.config/plugin.json@name',
          basePath
        );

        expect(result).toBe('');
        // Should only search in commandsDir and basePath
        expect(mockedGlob).toHaveBeenCalledTimes(2);
      } finally {
        // Clean up
        fs.rmSync(outerDir, { recursive: true, force: true });
      }
    });

    test('should use cache for repeated calls', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({ name: 'cached-prefix' }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      // First call - should hit the file system
      const result1 = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );
      expect(result1).toBe('cached-prefix');
      expect(mockedGlob).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );
      expect(result2).toBe('cached-prefix');
      expect(mockedGlob).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    test('should cache empty results', async () => {
      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return no matches
      mockedGlob.mockResolvedValue([]);

      // First call
      const result1 = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );
      expect(result1).toBe('');
      const firstCallCount = mockedGlob.mock.calls.length;

      // Second call - should use cache
      const result2 = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );
      expect(result2).toBe('');
      expect(mockedGlob.mock.calls).toHaveLength(firstCallCount); // No additional calls
    });

    test('should use different cache entries for different patterns', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });

      // Create two different JSON files
      const pluginFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(pluginFile, JSON.stringify({ name: 'plugin-prefix' }));

      const settingsFile = path.join(configDir, 'settings.json');
      fs.writeFileSync(settingsFile, JSON.stringify({ name: 'settings-prefix' }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return appropriate file based on pattern
      (mockedGlob as any).mockImplementation(async (pattern: string) => {
        if (pattern.includes('plugin.json')) {
          return [pluginFile];
        } else if (pattern.includes('settings.json')) {
          return [settingsFile];
        }
        return [];
      });

      // Get prefix from plugin.json
      const result1 = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );
      expect(result1).toBe('plugin-prefix');

      // Get prefix from settings.json
      const result2 = await resolvePrefix(
        commandFilePath,
        '.config/settings.json@name',
        testDir
      );
      expect(result2).toBe('settings-prefix');

      // Both should have been called
      expect(mockedGlob).toHaveBeenCalledTimes(2);
    });

    test('should handle glob pattern wildcards', async () => {
      // Create directory structure
      const pluginDir = path.join(testDir, '.claude-plugin');
      fs.mkdirSync(pluginDir, { recursive: true });
      const pluginFile = path.join(pluginDir, 'plugin.json');
      fs.writeFileSync(pluginFile, JSON.stringify({ name: 'wildcard-prefix' }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the plugin file
      mockedGlob.mockResolvedValue([pluginFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '**/.claude-plugin/plugin.json@name',
        testDir
      );

      expect(result).toBe('wildcard-prefix');
    });

    test('should use first match when multiple files are found', async () => {
      // Create directory structure with multiple matching files
      const configDir1 = path.join(testDir, 'config1');
      fs.mkdirSync(configDir1, { recursive: true });
      const configFile1 = path.join(configDir1, 'plugin.json');
      fs.writeFileSync(configFile1, JSON.stringify({ name: 'first-prefix' }));

      const configDir2 = path.join(testDir, 'config2');
      fs.mkdirSync(configDir2, { recursive: true });
      const configFile2 = path.join(configDir2, 'plugin.json');
      fs.writeFileSync(configFile2, JSON.stringify({ name: 'second-prefix' }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return multiple matches
      mockedGlob.mockResolvedValue([configFile1, configFile2]);

      const result = await resolvePrefix(
        commandFilePath,
        '**/plugin.json@name',
        testDir
      );

      // Should use the first match
      expect(result).toBe('first-prefix');
    });

    test('should select the closest match when multiple plugin.json files exist', async () => {
      // Create nested directory structure
      // testDir/
      //   .claude-plugin/plugin.json (name: 'root-plugin')
      //   plugins/
      //     ralph-loop/
      //       .claude-plugin/plugin.json (name: 'ralph-loop')
      //       commands/help.md

      // Root level plugin
      const rootPluginDir = path.join(testDir, '.claude-plugin');
      fs.mkdirSync(rootPluginDir, { recursive: true });
      const rootPluginFile = path.join(rootPluginDir, 'plugin.json');
      fs.writeFileSync(rootPluginFile, JSON.stringify({ name: 'root-plugin' }));

      // Nested plugin
      const ralphLoopDir = path.join(testDir, 'plugins', 'ralph-loop');
      const ralphPluginDir = path.join(ralphLoopDir, '.claude-plugin');
      fs.mkdirSync(ralphPluginDir, { recursive: true });
      const ralphPluginFile = path.join(ralphPluginDir, 'plugin.json');
      fs.writeFileSync(ralphPluginFile, JSON.stringify({ name: 'ralph-loop' }));

      // Command file in nested structure
      const commandsDir = path.join(ralphLoopDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'help.md');
      fs.writeFileSync(commandFilePath, '# Help Command');

      // Mock glob to return both plugin files (closer one first for glob order)
      mockedGlob.mockResolvedValue([ralphPluginFile, rootPluginFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '**/.claude-plugin/plugin.json@name',
        testDir
      );

      // Should select the closest match (ralph-loop) to the command file
      expect(result).toBe('ralph-loop');
    });
  });

  describe('clearPrefixCache', () => {
    test('should clear the cache', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({ name: 'initial-prefix' }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      // First call - cache the result
      const result1 = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );
      expect(result1).toBe('initial-prefix');
      expect(mockedGlob).toHaveBeenCalledTimes(1);

      // Update the JSON file
      fs.writeFileSync(configFile, JSON.stringify({ name: 'updated-prefix' }));

      // Second call without clearing cache - should return cached value
      const result2 = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );
      expect(result2).toBe('initial-prefix'); // Still cached
      expect(mockedGlob).toHaveBeenCalledTimes(1); // Not called again

      // Clear cache
      clearPrefixCache();

      // Third call after clearing cache - should fetch new value
      const result3 = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );
      expect(result3).toBe('updated-prefix'); // New value
      expect(mockedGlob).toHaveBeenCalledTimes(2); // Called again
    });

    test('should clear all cached entries', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const pluginFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(pluginFile, JSON.stringify({ name: 'plugin-prefix' }));
      const settingsFile = path.join(configDir, 'settings.json');
      fs.writeFileSync(settingsFile, JSON.stringify({ name: 'settings-prefix' }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return appropriate file
      (mockedGlob as any).mockImplementation(async (pattern: string) => {
        if (pattern.includes('plugin.json')) {
          return [pluginFile];
        } else if (pattern.includes('settings.json')) {
          return [settingsFile];
        }
        return [];
      });

      // Cache two different patterns
      await resolvePrefix(commandFilePath, '.config/plugin.json@name', testDir);
      await resolvePrefix(commandFilePath, '.config/settings.json@name', testDir);
      expect(mockedGlob).toHaveBeenCalledTimes(2);

      // Clear cache
      clearPrefixCache();

      // Both patterns should require new lookups
      await resolvePrefix(commandFilePath, '.config/plugin.json@name', testDir);
      await resolvePrefix(commandFilePath, '.config/settings.json@name', testDir);
      expect(mockedGlob).toHaveBeenCalledTimes(4); // 2 initial + 2 after clear
    });
  });

  describe('cache size limit', () => {
    test('should respect CACHE_MAX_SIZE limit', async () => {
      // Create base directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({ name: 'test-prefix' }));

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      // Create 100+ different command directories to exceed CACHE_MAX_SIZE
      const promises = [];
      for (let i = 0; i < 105; i++) {
        const commandDir = path.join(testDir, `commands-${i}`);
        fs.mkdirSync(commandDir, { recursive: true });
        const commandFilePath = path.join(commandDir, 'test.md');
        fs.writeFileSync(commandFilePath, '# Test Command');

        promises.push(
          resolvePrefix(commandFilePath, '.config/plugin.json@name', testDir)
        );
      }

      await Promise.all(promises);

      // All calls should succeed (cache eviction should work)
      expect(mockedGlob.mock.calls.length).toBeGreaterThan(0);
      expect(mockedGlob.mock.calls.length).toBeLessThanOrEqual(105);
    });
  });

  describe('edge cases', () => {
    test('should handle empty JSON file', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, '{}');

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );

      expect(result).toBe('');
    });

    test('should handle JSON with null value', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({ name: null }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );

      expect(result).toBe('');
    });

    test('should handle missing intermediate object in nested path', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({
        metadata: {
          version: '1.0.0'
          // name is missing
        }
      }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@metadata.name',
        testDir
      );

      expect(result).toBe('');
    });

    test('should handle missing parent object in nested path', async () => {
      // Create directory structure
      const configDir = path.join(testDir, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const configFile = path.join(configDir, 'plugin.json');
      fs.writeFileSync(configFile, JSON.stringify({ version: '1.0.0' }));

      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Mock glob to return the config file
      mockedGlob.mockResolvedValue([configFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@metadata.name',
        testDir
      );

      expect(result).toBe('');
    });

    test('should handle file read errors gracefully', async () => {
      // Create command file
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const commandFilePath = path.join(commandsDir, 'test.md');
      fs.writeFileSync(commandFilePath, '# Test Command');

      // Create a file that will cause read error (directory instead of file)
      const fakeConfigFile = path.join(testDir, '.config', 'plugin.json');
      fs.mkdirSync(fakeConfigFile, { recursive: true });

      // Mock glob to return the "file" (which is actually a directory)
      mockedGlob.mockResolvedValue([fakeConfigFile]);

      const result = await resolvePrefix(
        commandFilePath,
        '.config/plugin.json@name',
        testDir
      );

      expect(result).toBe('');
    });
  });
});
