import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import MdSearchLoader from '../../src/managers/md-search-loader';
import { promises as fs } from 'fs';
import type { MdSearchEntry } from '../../src/types';

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

// Mock os module for home directory expansion
jest.mock('os', () => ({
  homedir: jest.fn(() => '/Users/test')
}));

const mockedFs = jest.mocked(fs);

// Helper to create Dirent-like objects for readdir with withFileTypes
const createDirent = (name: string, isFile: boolean) => ({
  name,
  isFile: () => isFile,
  isDirectory: () => !isFile,
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isSymbolicLink: () => false,
  isFIFO: () => false,
  isSocket: () => false,
});

describe('MdSearchLoader', () => {
  let loader: MdSearchLoader;

  const createTestConfig = (overrides?: Partial<MdSearchEntry>[]): MdSearchEntry[] => {
    const defaults: MdSearchEntry[] = [
      {
        name: '{basename}',
        type: 'command',
        description: '{frontmatter@description}',
        path: '/path/to/commands',
        pattern: '*.md',
      },
      {
        name: '{basename}',
        type: 'mention',
        description: '{frontmatter@description}',
        path: '/path/to/agents',
        pattern: '*.md',
      },
    ];
    if (overrides) {
      return overrides.map((override, i) => ({ ...defaults[i % 2], ...override })) as MdSearchEntry[];
    }
    return defaults;
  };

  beforeEach(() => {
    loader = new MdSearchLoader(createTestConfig());
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      const config = createTestConfig();
      const testLoader = new MdSearchLoader(config);
      expect(testLoader).toBeInstanceOf(MdSearchLoader);
    });

    test('should use default config when none provided', () => {
      const testLoader = new MdSearchLoader();
      expect(testLoader).toBeInstanceOf(MdSearchLoader);
    });
  });

  describe('updateConfig', () => {
    test('should update config and invalidate cache', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test command\n---\nContent');

      // Load items to populate cache
      await loader.getItems('command');
      const firstReadCount = mockedFs.readdir.mock.calls.length;

      // Update config with different path
      const newConfig: MdSearchEntry[] = [
        { name: '{basename}', type: 'command', description: '{frontmatter@description}', path: '/new/path', pattern: '*.md' }
      ];
      loader.updateConfig(newConfig);

      // Verify cache was invalidated (readdir should be called again)
      mockedFs.readdir.mockResolvedValue([createDirent('new.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: New command\n---\nContent');

      await loader.getItems('command');

      expect(mockedFs.readdir.mock.calls.length).toBeGreaterThan(firstReadCount);
    });

    test('should not invalidate cache when same config is set', async () => {
      const config = createTestConfig();
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      // Load items
      await loader.getItems('command');
      const firstReadCount = mockedFs.readdir.mock.calls.length;

      // Set same config
      loader.updateConfig(config);

      // Cache should still be valid, no new reads
      await loader.getItems('command');
      expect(mockedFs.readdir.mock.calls.length).toBe(firstReadCount);
    });

    test('should use default config when undefined is passed', () => {
      loader.updateConfig(undefined);
      expect(loader).toBeInstanceOf(MdSearchLoader);
    });
  });

  describe('invalidateCache', () => {
    test('should force reload on next getItems call', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Original\n---\nContent');

      // First call
      await loader.getItems('command');
      const firstCallCount = mockedFs.readdir.mock.calls.length;

      // Invalidate cache
      loader.invalidateCache();

      // Modify mock
      mockedFs.readFile.mockResolvedValue('---\ndescription: New value\n---\nContent');

      // Should reload
      await loader.getItems('command');
      expect(mockedFs.readdir.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });

  describe('getItems', () => {
    test('should return items filtered by type', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        if (String(dir).includes('commands')) {
          return Promise.resolve([createDirent('cmd1.md', true), createDirent('cmd2.md', true)] as any);
        }
        return Promise.resolve([createDirent('agent1.md', true)] as any);
      });
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('cmd1')) return Promise.resolve('---\ndescription: Command 1\n---\n');
        if (pathStr.includes('cmd2')) return Promise.resolve('---\ndescription: Command 2\n---\n');
        return Promise.resolve('---\ndescription: Agent 1\n---\n');
      }) as any);

      const commands = await loader.getItems('command');
      const mentions = await loader.getItems('mention');

      expect(commands).toHaveLength(2);
      expect(commands.every(c => c.type === 'command')).toBe(true);

      expect(mentions).toHaveLength(1);
      expect(mentions.every(m => m.type === 'mention')).toBe(true);
    });

    test('should return empty array when directory does not exist', async () => {
      mockedFs.stat.mockRejectedValue({ code: 'ENOENT' } as any);

      const items = await loader.getItems('command');

      expect(items).toEqual([]);
    });

    test('should return empty array when path is not a directory', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as any);

      const items = await loader.getItems('command');

      expect(items).toEqual([]);
    });

    test('should sort items alphabetically by name', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('zebra.md', true),
        createDirent('alpha.md', true),
        createDirent('beta.md', true)
      ] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Command\n---\nContent');

      const items = await loader.getItems('command');

      expect(items.map(i => i.name)).toEqual(['alpha', 'beta', 'zebra']);
    });

    test('should use cache within TTL', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      // First call
      await loader.getItems('command');
      const firstCallCount = mockedFs.readdir.mock.calls.length;

      // Second call within TTL - should use cache
      await loader.getItems('command');
      expect(mockedFs.readdir.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('searchItems', () => {
    beforeEach(async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        if (String(dir).includes('commands')) {
          return Promise.resolve([
            createDirent('test-command.md', true),
            createDirent('another-cmd.md', true),
            createDirent('search-helper.md', true)
          ] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('test-command')) {
          return Promise.resolve('---\ndescription: A test command for testing\n---\nContent');
        }
        if (pathStr.includes('another-cmd')) {
          return Promise.resolve('---\ndescription: Another helpful utility\n---\nContent');
        }
        return Promise.resolve('---\ndescription: Search and find things\n---\nContent');
      }) as any);
    });

    test('should return all items of type when query is empty', async () => {
      const results = await loader.searchItems('command', '');

      expect(results).toHaveLength(3);
    });

    test('should find items by name', async () => {
      const results = await loader.searchItems('command', 'test');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('test-command');
    });

    test('should find items by description', async () => {
      const results = await loader.searchItems('command', 'helpful');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('another-cmd');
    });

    test('should be case-insensitive', async () => {
      const results = await loader.searchItems('command', 'TEST');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('test-command');
    });

    test('should find partial matches', async () => {
      const results = await loader.searchItems('command', 'search');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('search-helper');
    });

    test('should return empty array when no matches', async () => {
      const results = await loader.searchItems('command', 'nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('template resolution', () => {
    beforeEach(() => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/commands',
          pattern: '*.md',
          argumentHint: '{frontmatter@argument-hint}',
        },
      ]);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
    });

    test('should resolve {basename} template', async () => {
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      const items = await loader.getItems('command');

      expect(items[0]?.name).toBe('test');
    });

    test('should resolve {frontmatter@field} template', async () => {
      mockedFs.readFile.mockResolvedValue('---\ndescription: A helpful command\n---\nContent');

      const items = await loader.getItems('command');

      expect(items[0]?.description).toBe('A helpful command');
    });

    test('should resolve argumentHint from frontmatter', async () => {
      mockedFs.readFile.mockResolvedValue('---\ndescription: Command\nargument-hint: <filename>\n---\nContent');

      const items = await loader.getItems('command');

      expect(items[0]?.argumentHint).toBe('<filename>');
    });

    test('should handle missing frontmatter fields', async () => {
      mockedFs.readFile.mockResolvedValue('Just plain content without frontmatter');

      const items = await loader.getItems('command');

      expect(items[0]?.description).toBe('');
    });

    test('should handle empty frontmatter', async () => {
      mockedFs.readFile.mockResolvedValue('---\n---\nContent');

      const items = await loader.getItems('command');

      expect(items[0]?.description).toBe('');
    });

    test('should handle quoted description values', async () => {
      mockedFs.readFile.mockResolvedValue('---\ndescription: "A quoted description"\n---\nContent');

      const items = await loader.getItems('command');

      expect(items[0]?.description).toBe('A quoted description');
    });

    test('should handle single-quoted description values', async () => {
      mockedFs.readFile.mockResolvedValue("---\ndescription: 'Single quoted'\n---\nContent");

      const items = await loader.getItems('command');

      expect(items[0]?.description).toBe('Single quoted');
    });
  });

  describe('file pattern matching', () => {
    test('should match *.md pattern', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('test.md', true),
        createDirent('readme.txt', true),
        createDirent('script.js', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('test');
    });

    test('should match specific filename pattern', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/commands',
          pattern: 'SKILL.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('SKILL.md', true),
        createDirent('other.md', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Skill\n---\nContent');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
    });

    test('should handle recursive pattern **/*.md', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/commands',
          pattern: '**/*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr === '/path/to/commands') {
          return Promise.resolve([
            createDirent('root.md', true),
            createDirent('subdir', false), // directory
          ] as any);
        }
        if (dirStr === '/path/to/commands/subdir') {
          return Promise.resolve([
            createDirent('nested.md', true),
          ] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockResolvedValue('---\ndescription: Command\n---\nContent');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['nested', 'root']);
    });

    test('should handle intermediate directory pattern **/commands/*.md', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/root',
          pattern: '**/commands/*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr === '/path/to/root') {
          return Promise.resolve([
            createDirent('root.md', true),
            createDirent('project1', false), // directory
            createDirent('project2', false), // directory
          ] as any);
        }
        if (dirStr === '/path/to/root/project1') {
          return Promise.resolve([
            createDirent('commands', false), // directory
            createDirent('other', false), // directory
          ] as any);
        }
        if (dirStr === '/path/to/root/project1/commands') {
          return Promise.resolve([
            createDirent('cmd1.md', true),
            createDirent('cmd2.md', true),
          ] as any);
        }
        if (dirStr === '/path/to/root/project1/other') {
          return Promise.resolve([
            createDirent('not-matched.md', true),
          ] as any);
        }
        if (dirStr === '/path/to/root/project2') {
          return Promise.resolve([
            createDirent('commands', false), // directory
          ] as any);
        }
        if (dirStr === '/path/to/root/project2/commands') {
          return Promise.resolve([
            createDirent('cmd3.md', true),
          ] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockResolvedValue('---\ndescription: Command\n---\nContent');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['cmd1', 'cmd2', 'cmd3']);
    });

    test('should handle wildcard intermediate pattern **/*/*.md', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/root',
          pattern: '**/*/*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr === '/path/to/root') {
          return Promise.resolve([
            createDirent('plugin1', false),
            createDirent('plugin2', false),
          ] as any);
        }
        if (dirStr === '/path/to/root/plugin1') {
          return Promise.resolve([
            createDirent('skill1.md', true),
            createDirent('README.md', true),
          ] as any);
        }
        if (dirStr === '/path/to/root/plugin2') {
          return Promise.resolve([
            createDirent('skill2.md', true),
          ] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockResolvedValue('---\ndescription: Skill\n---\nContent');

      const items = await loader.getItems('command');

      // Three different files matched: skill1.md, README.md, skill2.md
      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['README', 'skill1', 'skill2']);
    });

    test('should handle brace expansion pattern **/{commands,agents}/*.md', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/root',
          pattern: '**/{commands,agents}/*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr === '/path/to/root') {
          return Promise.resolve([
            createDirent('commands', false),
            createDirent('agents', false),
            createDirent('other', false),
          ] as any);
        }
        if (dirStr === '/path/to/root/commands') {
          return Promise.resolve([
            createDirent('cmd1.md', true),
          ] as any);
        }
        if (dirStr === '/path/to/root/agents') {
          return Promise.resolve([
            createDirent('agent1.md', true),
          ] as any);
        }
        if (dirStr === '/path/to/root/other') {
          return Promise.resolve([
            createDirent('not-matched.md', true),
          ] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockResolvedValue('---\ndescription: Item\n---\nContent');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['agent1', 'cmd1']);
    });

    test('should handle deeply nested intermediate directory pattern', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/root',
          pattern: '**/plugins/*/commands/*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr === '/path/to/root') {
          return Promise.resolve([
            createDirent('plugins', false),
          ] as any);
        }
        if (dirStr === '/path/to/root/plugins') {
          return Promise.resolve([
            createDirent('my-plugin', false),
          ] as any);
        }
        if (dirStr === '/path/to/root/plugins/my-plugin') {
          return Promise.resolve([
            createDirent('commands', false),
          ] as any);
        }
        if (dirStr === '/path/to/root/plugins/my-plugin/commands') {
          return Promise.resolve([
            createDirent('deep-cmd.md', true),
          ] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockResolvedValue('---\ndescription: Deep Command\n---\nContent');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('deep-cmd');
    });

    test('should handle pattern with wildcard prefix test-*.md', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/commands',
          pattern: 'test-*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('test-command.md', true),
        createDirent('test-other.md', true),
        createDirent('command.md', true),
        createDirent('not-test.md', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['test-command', 'test-other']);
    });
  });

  describe('duplicate handling', () => {
    test('should prevent duplicates within same type', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/one',
          pattern: '*.md',
        },
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/two',
          pattern: '*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation(() => {
        return Promise.resolve([createDirent('duplicate.md', true)] as any);
      });
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('/path/one/')) {
          return Promise.resolve('---\ndescription: First version\n---\n');
        }
        return Promise.resolve('---\ndescription: Second version\n---\n');
      }) as any);

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.description).toBe('First version');
    });

    test('should allow same name in different types', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/commands',
          pattern: '*.md',
        },
        {
          name: '{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          path: '/path/agents',
          pattern: '*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('same-name.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Item\n---\n');

      const commands = await loader.getItems('command');
      const mentions = await loader.getItems('mention');

      expect(commands).toHaveLength(1);
      expect(mentions).toHaveLength(1);
    });
  });

  describe('home directory expansion', () => {
    test('should expand ~ to home directory', async () => {
      loader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '~/.claude/commands',
          pattern: '*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\n');

      await loader.getItems('command');

      expect(mockedFs.stat).toHaveBeenCalledWith('/Users/test/.claude/commands');
    });
  });

  describe('error handling', () => {
    test('should handle stat error', async () => {
      mockedFs.stat.mockRejectedValue(new Error('Permission denied'));

      const items = await loader.getItems('command');

      expect(items).toEqual([]);
    });

    test('should handle readdir error', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockRejectedValue(new Error('Cannot read directory'));

      const items = await loader.getItems('command');

      expect(items).toEqual([]);
    });

    test('should skip unreadable files and continue with others', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('good.md', true),
        createDirent('bad.md', true),
        createDirent('another-good.md', true)
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('bad.md')) {
          return Promise.reject(new Error('File read error'));
        }
        return Promise.resolve('---\ndescription: Good command\n---\n');
      }) as any);

      const items = await loader.getItems('command');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['another-good', 'good']);
    });

    test('should handle empty directory', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([] as any);

      const items = await loader.getItems('command');

      expect(items).toEqual([]);
    });
  });

  describe('frontmatter extraction', () => {
    beforeEach(() => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
    });

    test('should include raw frontmatter in item', async () => {
      const content = `---
description: Test description
argument-hint: <arg>
custom-field: custom value
---
Content`;
      mockedFs.readFile.mockResolvedValue(content);

      const items = await loader.getItems('command');

      expect(items[0]?.frontmatter).toBeDefined();
      expect(items[0]?.frontmatter).toContain('description: Test description');
      expect(items[0]?.frontmatter).toContain('argument-hint: <arg>');
    });

    test('should not include frontmatter when file has no frontmatter', async () => {
      mockedFs.readFile.mockResolvedValue('Just plain content');

      const items = await loader.getItems('command');

      expect(items[0]?.frontmatter).toBeUndefined();
    });
  });

  describe('sourceId', () => {
    test('should include sourceId in items', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\n');

      const items = await loader.getItems('command');

      expect(items[0]?.sourceId).toBe('/path/to/commands:*.md');
    });
  });

  describe('searchPrefix', () => {
    let prefixLoader: MdSearchLoader;

    beforeEach(() => {
      // searchPrefixが設定されたmention設定を持つローダーを作成
      prefixLoader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/commands',
          pattern: '*.md',
          // searchPrefixなし - 常に検索対象
        },
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          path: '/path/to/agents',
          pattern: '*.md',
          searchPrefix: 'agent:',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        if (String(dir).includes('commands')) {
          return Promise.resolve([createDirent('test-cmd.md', true)] as any);
        }
        return Promise.resolve([
          createDirent('helper.md', true),
          createDirent('search-bot.md', true),
        ] as any);
      });
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('test-cmd')) {
          return Promise.resolve('---\ndescription: Test command\n---\n');
        }
        if (pathStr.includes('helper')) {
          return Promise.resolve('---\ndescription: Helper agent for tasks\n---\n');
        }
        return Promise.resolve('---\ndescription: Search bot agent\n---\n');
      }) as any);
    });

    test('should exclude items with searchPrefix when query does not start with prefix', async () => {
      // クエリがプレフィックスで始まらない場合、searchPrefix付きエントリは除外
      const results = await prefixLoader.searchItems('mention', 'search');

      expect(results).toHaveLength(0);
    });

    test('should include items with searchPrefix when query starts with prefix', async () => {
      // クエリがプレフィックスで始まる場合、searchPrefix付きエントリを含む
      const results = await prefixLoader.searchItems('mention', 'agent:');

      expect(results).toHaveLength(2);
    });

    test('should search with actual query after removing prefix', async () => {
      // プレフィックス除去後のクエリで検索
      const results = await prefixLoader.searchItems('mention', 'agent:search');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('agent-search-bot');
    });

    test('should search by description with prefix', async () => {
      // 説明でも検索可能
      const results = await prefixLoader.searchItems('mention', 'agent:helper');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('agent-helper');
    });

    test('should always include items without searchPrefix', async () => {
      // searchPrefixが設定されていないエントリは常に検索対象
      const results = await prefixLoader.searchItems('command', '');

      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe('command');
    });

    test('should be case-sensitive for prefix matching', async () => {
      // プレフィックスマッチングは大文字小文字を区別
      const results = await prefixLoader.searchItems('mention', 'AGENT:search');

      expect(results).toHaveLength(0);
    });

    test('should handle multiple entries with different searchPrefix', async () => {
      // 複数エントリで異なるsearchPrefixの場合
      const multiPrefixLoader = new MdSearchLoader([
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          path: '/path/to/agents',
          pattern: '*.md',
          searchPrefix: 'agent:',
        },
        {
          name: 'tool-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          path: '/path/to/tools',
          pattern: '*.md',
          searchPrefix: 'tool:',
        },
      ]);

      mockedFs.readdir.mockImplementation((dir) => {
        if (String(dir).includes('agents')) {
          return Promise.resolve([createDirent('helper.md', true)] as any);
        }
        if (String(dir).includes('tools')) {
          return Promise.resolve([createDirent('formatter.md', true)] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('helper')) {
          return Promise.resolve('---\ndescription: Helper agent\n---\n');
        }
        return Promise.resolve('---\ndescription: Formatter tool\n---\n');
      }) as any);

      // agent:で検索 - agentのみ
      const agentResults = await multiPrefixLoader.searchItems('mention', 'agent:');
      expect(agentResults).toHaveLength(1);
      expect(agentResults[0]?.name).toBe('agent-helper');

      // tool:で検索 - toolのみ
      multiPrefixLoader.invalidateCache();
      const toolResults = await multiPrefixLoader.searchItems('mention', 'tool:');
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0]?.name).toBe('tool-formatter');

      // プレフィックスなしで検索 - 両方除外
      multiPrefixLoader.invalidateCache();
      const noResults = await multiPrefixLoader.searchItems('mention', '');
      expect(noResults).toHaveLength(0);
    });

    test('should return all items when prefix only is provided', async () => {
      // プレフィックスのみ入力時は全アイテム表示
      const results = await prefixLoader.searchItems('mention', 'agent:');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name).sort()).toEqual(['agent-helper', 'agent-search-bot']);
    });
  });

  describe('getSearchPrefixes', () => {
    test('should return empty array when no prefixes configured', () => {
      const noPrefixLoader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/commands',
          pattern: '*.md',
        },
      ]);

      const prefixes = noPrefixLoader.getSearchPrefixes('command');
      expect(prefixes).toEqual([]);
    });

    test('should return configured prefixes for type', () => {
      const prefixLoader = new MdSearchLoader([
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          path: '/path/to/agents',
          pattern: '*.md',
          searchPrefix: 'agent:',
        },
      ]);

      const prefixes = prefixLoader.getSearchPrefixes('mention');
      expect(prefixes).toEqual(['agent:']);
    });

    test('should return multiple prefixes when configured', () => {
      const multiPrefixLoader = new MdSearchLoader([
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          path: '/path/to/agents',
          pattern: '*.md',
          searchPrefix: 'agent:',
        },
        {
          name: 'tool-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          path: '/path/to/tools',
          pattern: '*.md',
          searchPrefix: 'tool:',
        },
      ]);

      const prefixes = multiPrefixLoader.getSearchPrefixes('mention');
      expect(prefixes).toEqual(['agent:', 'tool:']);
    });

    test('should only return prefixes for specified type', () => {
      const mixedLoader = new MdSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/commands',
          pattern: '*.md',
          searchPrefix: 'cmd:',
        },
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          path: '/path/to/agents',
          pattern: '*.md',
          searchPrefix: 'agent:',
        },
      ]);

      const commandPrefixes = mixedLoader.getSearchPrefixes('command');
      expect(commandPrefixes).toEqual(['cmd:']);

      const mentionPrefixes = mixedLoader.getSearchPrefixes('mention');
      expect(mentionPrefixes).toEqual(['agent:']);
    });
  });
});
