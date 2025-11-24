import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import SlashCommandLoader from '../../src/managers/slash-command-loader';
import { promises as fs } from 'fs';

// Mock fs promises module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn()
  }
}));

// Mock the utils module
jest.mock('../../src/utils/utils', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const mockedFs = jest.mocked(fs);

describe('SlashCommandLoader', () => {
  let loader: SlashCommandLoader;

  beforeEach(() => {
    loader = new SlashCommandLoader();
    jest.clearAllMocks();
  });

  describe('setDirectories', () => {
    test('should set directories from empty state', () => {
      loader.setDirectories(['/path/to/commands']);

      expect(loader.getDirectories()).toEqual(['/path/to/commands']);
    });

    test('should set multiple directories', () => {
      loader.setDirectories(['/path/one', '/path/two', '/path/three']);

      expect(loader.getDirectories()).toEqual(['/path/one', '/path/two', '/path/three']);
    });

    test('should handle undefined directories', () => {
      loader.setDirectories(undefined);

      expect(loader.getDirectories()).toEqual([]);
    });

    test('should handle empty array', () => {
      loader.setDirectories([]);

      expect(loader.getDirectories()).toEqual([]);
    });

    test('should detect change when directories change', () => {
      loader.setDirectories(['/path/one']);
      loader.setDirectories(['/path/two']);

      expect(loader.getDirectories()).toEqual(['/path/two']);
    });

    test('should detect change when directories are added', () => {
      loader.setDirectories(['/path/one']);
      loader.setDirectories(['/path/one', '/path/two']);

      expect(loader.getDirectories()).toEqual(['/path/one', '/path/two']);
    });

    test('should detect change when directories are removed', () => {
      loader.setDirectories(['/path/one', '/path/two']);
      loader.setDirectories(['/path/one']);

      expect(loader.getDirectories()).toEqual(['/path/one']);
    });

    test('should invalidate cache when directories change', async () => {
      // Setup initial state with cached commands
      loader.setDirectories(['/path/to/commands']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test command\n---\nContent');

      // Load commands to populate cache
      await loader.getCommands();

      // Change directories - should invalidate cache
      loader.setDirectories(['/path/to/other']);

      // Verify directories changed
      expect(loader.getDirectories()).toEqual(['/path/to/other']);
    });

    test('should not invalidate cache when same directories are set', async () => {
      loader.setDirectories(['/path/to/commands']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test command\n---\nContent');

      // Load commands
      await loader.getCommands();

      // Set same directories
      loader.setDirectories(['/path/to/commands']);

      // Should still have same directories
      expect(loader.getDirectories()).toEqual(['/path/to/commands']);
    });
  });

  describe('getDirectories', () => {
    test('should return empty array when no directories set', () => {
      expect(loader.getDirectories()).toEqual([]);
    });

    test('should return copy of directories array', () => {
      loader.setDirectories(['/path/one', '/path/two']);

      const dirs1 = loader.getDirectories();
      const dirs2 = loader.getDirectories();

      expect(dirs1).toEqual(dirs2);
      expect(dirs1).not.toBe(dirs2); // Different objects
    });

    test('should not allow modification of internal directories', () => {
      loader.setDirectories(['/path/one']);

      const dirs = loader.getDirectories();
      dirs.push('/path/modified');

      expect(loader.getDirectories()).toEqual(['/path/one']);
    });
  });

  describe('getCommands', () => {
    test('should return empty array when no directories set', async () => {
      const commands = await loader.getCommands();

      expect(commands).toEqual([]);
    });

    test('should load commands from single directory', async () => {
      loader.setDirectories(['/path/to/commands']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md', 'another.md'] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        if (String(filePath).includes('test.md')) {
          return Promise.resolve('---\ndescription: Test command\n---\nContent');
        }
        return Promise.resolve('---\ndescription: Another command\n---\nContent');
      }) as any);

      const commands = await loader.getCommands();

      expect(commands).toHaveLength(2);
      expect(commands[0]?.name).toBe('another');
      expect(commands[1]?.name).toBe('test');
    });

    test('should load commands from multiple directories', async () => {
      loader.setDirectories(['/path/one', '/path/two']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        if (String(dir) === '/path/one') {
          return Promise.resolve(['cmd1.md'] as any);
        }
        return Promise.resolve(['cmd2.md'] as any);
      });
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        if (String(filePath).includes('cmd1.md')) {
          return Promise.resolve('---\ndescription: Command 1\n---\nContent');
        }
        return Promise.resolve('---\ndescription: Command 2\n---\nContent');
      }) as any);

      const commands = await loader.getCommands();

      expect(commands).toHaveLength(2);
      expect(commands.map(c => c.name).sort()).toEqual(['cmd1', 'cmd2']);
    });

    test('should filter non-.md files', async () => {
      loader.setDirectories(['/path/to/commands']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md', 'readme.txt', 'script.js', '.hidden.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      const commands = await loader.getCommands();

      // Only .md files should be loaded
      expect(commands).toHaveLength(2); // test.md and .hidden.md
    });

    test('should sort commands alphabetically', async () => {
      loader.setDirectories(['/path/to/commands']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['zebra.md', 'alpha.md', 'beta.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Command\n---\nContent');

      const commands = await loader.getCommands();

      expect(commands.map(c => c.name)).toEqual(['alpha', 'beta', 'zebra']);
    });

    test('should use cache within TTL', async () => {
      loader.setDirectories(['/path/to/commands']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      // First call
      await loader.getCommands();
      expect(mockedFs.readdir).toHaveBeenCalledTimes(1);

      // Second call within TTL - should use cache
      await loader.getCommands();
      expect(mockedFs.readdir).toHaveBeenCalledTimes(1); // Not called again
    });

    test('should reload after TTL expires', async () => {
      loader.setDirectories(['/path/to/commands']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      // First call
      await loader.getCommands();
      expect(mockedFs.readdir).toHaveBeenCalledTimes(1);

      // Manually invalidate cache to simulate TTL expiration
      loader.invalidateCache();

      // Second call after cache invalidation
      await loader.getCommands();
      expect(mockedFs.readdir).toHaveBeenCalledTimes(2);
    });

    test('should return empty array on error', async () => {
      loader.setDirectories(['/path/to/commands']);

      mockedFs.stat.mockRejectedValue(new Error('File system error'));

      const commands = await loader.getCommands();

      expect(commands).toEqual([]);
    });
  });

  describe('loadCommandsFromDirectory (via getCommands)', () => {
    test('should handle non-existent directory', async () => {
      loader.setDirectories(['/non/existent/path']);

      mockedFs.stat.mockRejectedValue({ code: 'ENOENT' } as any);

      const commands = await loader.getCommands();

      expect(commands).toEqual([]);
    });

    test('should handle path that is not a directory', async () => {
      loader.setDirectories(['/path/to/file.txt']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as any);

      const commands = await loader.getCommands();

      expect(commands).toEqual([]);
    });

    test('should handle mixed valid and invalid directories', async () => {
      loader.setDirectories(['/valid/path', '/invalid/path']);

      mockedFs.stat.mockImplementation((path) => {
        if (String(path) === '/valid/path') {
          return Promise.resolve({ isDirectory: () => true } as any);
        }
        return Promise.reject({ code: 'ENOENT' });
      });
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      const commands = await loader.getCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]?.name).toBe('test');
    });

    test('should return commands with correct filePath', async () => {
      loader.setDirectories(['/path/to/commands']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['mycommand.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: My command\n---\nContent');

      const commands = await loader.getCommands();

      expect(commands[0]?.filePath).toBe('/path/to/commands/mycommand.md');
    });
  });

  describe('parseCommandFile (via getCommands)', () => {
    beforeEach(() => {
      loader.setDirectories(['/path/to/commands']);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
    });

    test('should parse command with description', async () => {
      mockedFs.readFile.mockResolvedValue('---\ndescription: A helpful command\n---\nContent here');

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('A helpful command');
    });

    test('should parse command with argument-hint', async () => {
      mockedFs.readFile.mockResolvedValue('---\ndescription: Command\nargument-hint: <filename>\n---\nContent');

      const commands = await loader.getCommands();

      expect(commands[0]?.argumentHint).toBe('<filename>');
    });

    test('should parse command with both description and argument-hint', async () => {
      const content = `---
description: A command that takes a file
argument-hint: <path/to/file>
---
# Command Content
This is the command body.`;

      mockedFs.readFile.mockResolvedValue(content);

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('A command that takes a file');
      expect(commands[0]?.argumentHint).toBe('<path/to/file>');
    });

    test('should use filename as command name without .md extension', async () => {
      mockedFs.readdir.mockResolvedValue(['my-command.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      const commands = await loader.getCommands();

      expect(commands[0]?.name).toBe('my-command');
    });

    test('should handle file without frontmatter', async () => {
      mockedFs.readFile.mockResolvedValue('Just plain content without frontmatter');

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('');
      expect(commands[0]?.argumentHint).toBeUndefined();
    });

    test('should handle file with empty frontmatter', async () => {
      mockedFs.readFile.mockResolvedValue('---\n---\nContent');

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('');
    });

    test('should handle file read error gracefully', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('Read failed'));

      const commands = await loader.getCommands();

      expect(commands).toEqual([]);
    });

    test('should handle quoted description values', async () => {
      mockedFs.readFile.mockResolvedValue('---\ndescription: "A quoted description"\n---\nContent');

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('A quoted description');
    });

    test('should handle single-quoted description values', async () => {
      mockedFs.readFile.mockResolvedValue("---\ndescription: 'Single quoted'\n---\nContent");

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('Single quoted');
    });

    test('should handle quoted argument-hint values', async () => {
      mockedFs.readFile.mockResolvedValue('---\nargument-hint: "<required>"\n---\nContent');

      const commands = await loader.getCommands();

      expect(commands[0]?.argumentHint).toBe('<required>');
    });
  });

  describe('extractFrontmatter', () => {
    // Test through parseCommandFile via getCommands
    beforeEach(() => {
      loader.setDirectories(['/path/to/commands']);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
    });

    test('should handle frontmatter with extra whitespace around value', async () => {
      // Note: The regex requires 'description:' at the start of a line (no leading spaces)
      // Whitespace around the value is trimmed
      mockedFs.readFile.mockResolvedValue('---\ndescription:   Spaced description  \n---\nContent');

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('Spaced description');
    });

    test('should handle multiline content after frontmatter', async () => {
      const content = `---
description: Test
---
# Title
Line 1
Line 2
Line 3`;

      mockedFs.readFile.mockResolvedValue(content);

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('Test');
    });

    test('should not match invalid frontmatter format', async () => {
      // Missing closing ---
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\nNo closing marker');

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('');
    });

    test('should handle frontmatter with other fields', async () => {
      const content = `---
title: My Command
description: Actual description
author: Test Author
argument-hint: <arg>
version: 1.0
---
Content`;

      mockedFs.readFile.mockResolvedValue(content);

      const commands = await loader.getCommands();

      expect(commands[0]?.description).toBe('Actual description');
      expect(commands[0]?.argumentHint).toBe('<arg>');
    });
  });

  describe('searchCommands', () => {
    beforeEach(async () => {
      loader.setDirectories(['/path/to/commands']);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test-command.md', 'another-cmd.md', 'search-helper.md'] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const path = String(filePath);
        if (path.includes('test-command')) {
          return Promise.resolve('---\ndescription: A test command for testing\n---\nContent');
        }
        if (path.includes('another-cmd')) {
          return Promise.resolve('---\ndescription: Another helpful utility\n---\nContent');
        }
        return Promise.resolve('---\ndescription: Search and find things\n---\nContent');
      }) as any);
    });

    test('should return all commands when query is empty', async () => {
      const results = await loader.searchCommands('');

      expect(results).toHaveLength(3);
    });

    test('should find commands by name', async () => {
      const results = await loader.searchCommands('test');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('test-command');
    });

    test('should find commands by description', async () => {
      const results = await loader.searchCommands('helpful');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('another-cmd');
    });

    test('should be case-insensitive', async () => {
      const results = await loader.searchCommands('TEST');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('test-command');
    });

    test('should find partial matches', async () => {
      const results = await loader.searchCommands('search');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('search-helper');
    });

    test('should return empty array when no matches', async () => {
      const results = await loader.searchCommands('nonexistent');

      expect(results).toEqual([]);
    });

    test('should match in both name and description', async () => {
      const results = await loader.searchCommands('command');

      // Matches 'test-command' (name) and 'test-command' (description contains "command")
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('duplicate command handling', () => {
    test('should give precedence to first directory', async () => {
      loader.setDirectories(['/priority/path', '/secondary/path']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((() => {
        // Both directories have same filename
        return Promise.resolve(['duplicate.md'] as any);
      }) as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const path = String(filePath);
        if (path.includes('priority')) {
          return Promise.resolve('---\ndescription: Priority version\n---\nContent');
        }
        return Promise.resolve('---\ndescription: Secondary version\n---\nContent');
      }) as any);

      const commands = await loader.getCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]?.description).toBe('Priority version');
      expect(commands[0]?.filePath).toContain('priority');
    });

    test('should skip duplicates from later directories', async () => {
      loader.setDirectories(['/first', '/second', '/third']);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation(((dir: any) => {
        const dirStr = String(dir);
        if (dirStr === '/first') {
          return Promise.resolve(['cmd-a.md', 'cmd-b.md'] as any);
        }
        if (dirStr === '/second') {
          return Promise.resolve(['cmd-b.md', 'cmd-c.md'] as any); // cmd-b is duplicate
        }
        return Promise.resolve(['cmd-c.md', 'cmd-d.md'] as any); // cmd-c is duplicate
      }) as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const path = String(filePath);
        if (path.includes('/first/')) {
          return Promise.resolve('---\ndescription: From first\n---\n');
        }
        if (path.includes('/second/')) {
          return Promise.resolve('---\ndescription: From second\n---\n');
        }
        return Promise.resolve('---\ndescription: From third\n---\n');
      }) as any);

      const commands = await loader.getCommands();

      expect(commands).toHaveLength(4); // cmd-a, cmd-b (first), cmd-c (second), cmd-d (third)

      const cmdB = commands.find(c => c.name === 'cmd-b');
      expect(cmdB?.description).toBe('From first');

      const cmdC = commands.find(c => c.name === 'cmd-c');
      expect(cmdC?.description).toBe('From second');
    });
  });

  describe('cache behavior', () => {
    test('should cache commands after first load', async () => {
      loader.setDirectories(['/path/to/commands']);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\n');

      // First call
      const first = await loader.getCommands();

      // Modify mock to return different result
      mockedFs.readFile.mockResolvedValue('---\ndescription: Modified\n---\n');

      // Second call should return cached result
      const second = await loader.getCommands();

      expect(first[0]?.description).toBe('Test');
      expect(second[0]?.description).toBe('Test'); // Still cached value
    });

    test('should invalidate cache when directories change', async () => {
      loader.setDirectories(['/path/one']);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: From path one\n---\n');

      // Load initial commands
      const first = await loader.getCommands();
      expect(first[0]?.description).toBe('From path one');

      // Change directories
      loader.setDirectories(['/path/two']);
      mockedFs.readFile.mockResolvedValue('---\ndescription: From path two\n---\n');

      // Should load fresh data
      const second = await loader.getCommands();
      expect(second[0]?.description).toBe('From path two');
    });

    test('invalidateCache should force reload', async () => {
      loader.setDirectories(['/path/to/commands']);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Original\n---\n');

      // First call
      await loader.getCommands();

      // Invalidate cache
      loader.invalidateCache();

      // Modify mock
      mockedFs.readFile.mockResolvedValue('---\ndescription: New value\n---\n');

      // Should reload
      const fresh = await loader.getCommands();
      expect(fresh[0]?.description).toBe('New value');
    });
  });

  describe('error handling', () => {
    test('should handle stat error for directory', async () => {
      loader.setDirectories(['/error/path']);
      mockedFs.stat.mockRejectedValue(new Error('Permission denied'));

      const commands = await loader.getCommands();

      expect(commands).toEqual([]);
    });

    test('should handle readdir error', async () => {
      loader.setDirectories(['/path/to/commands']);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockRejectedValue(new Error('Cannot read directory'));

      const commands = await loader.getCommands();

      expect(commands).toEqual([]);
    });

    test('should continue loading from other directories when one has ENOENT error', async () => {
      // Note: Only ENOENT errors are handled gracefully, other errors are thrown
      loader.setDirectories(['/missing/path', '/working/path']);

      mockedFs.stat.mockImplementation((path) => {
        if (String(path) === '/missing/path') {
          return Promise.reject({ code: 'ENOENT' });
        }
        return Promise.resolve({ isDirectory: () => true } as any);
      });
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Working\n---\n');

      const commands = await loader.getCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]?.description).toBe('Working');
    });

    test('should return empty array when non-ENOENT error occurs', async () => {
      // Non-ENOENT errors (like permission denied) cause the entire load to fail
      loader.setDirectories(['/failing/path', '/working/path']);

      mockedFs.stat.mockImplementation((path) => {
        if (String(path) === '/failing/path') {
          return Promise.reject(new Error('Access denied'));
        }
        return Promise.resolve({ isDirectory: () => true } as any);
      });
      mockedFs.readdir.mockResolvedValue(['test.md'] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Working\n---\n');

      const commands = await loader.getCommands();

      // Since the first directory throws a non-ENOENT error, getCommands catches it
      // and returns an empty array
      expect(commands).toEqual([]);
    });

    test('should skip unreadable files and continue with others', async () => {
      loader.setDirectories(['/path/to/commands']);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue(['good.md', 'bad.md', 'another-good.md'] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const path = String(filePath);
        if (path.includes('bad.md')) {
          return Promise.reject(new Error('File read error'));
        }
        return Promise.resolve('---\ndescription: Good command\n---\n');
      }) as any);

      const commands = await loader.getCommands();

      expect(commands).toHaveLength(2);
      expect(commands.map(c => c.name).sort()).toEqual(['another-good', 'good']);
    });

    test('should handle empty directory', async () => {
      loader.setDirectories(['/empty/path']);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([] as any);

      const commands = await loader.getCommands();

      expect(commands).toEqual([]);
    });
  });
});
