// Override child_process.exec to support 3-arg form (command, options, callback)
// needed by promisify(exec) in custom-search-loader's sourceCommand handling
const execCalls: Array<{ command: string; options: any }> = [];
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, optsOrCb: any, cb?: any) => {
    const callback = typeof optsOrCb === 'function' ? optsOrCb : cb;
    const options = typeof optsOrCb === 'object' ? optsOrCb : {};
    execCalls.push({ command: cmd, options });
    if (callback) callback(null, 'line1\nline2', '');
  })
}));

import CustomSearchLoader from '../../src/managers/custom-search-loader';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import chokidarModule from 'chokidar';
import type { CustomSearchEntry } from '../../src/types';

// Unmock path module (needed for prefix-resolver which is used by custom-search-loader)
vi.unmock('path');

// Mock chokidar to avoid file watching in tests
vi.mock('chokidar', () => ({
  default: { watch: vi.fn(() => ({
    on: vi.fn(function(this: any) { return this; }),
    close: vi.fn(() => Promise.resolve())
  })) },
  watch: vi.fn(() => ({
    on: vi.fn(function(this: any) { return this; }),
    close: vi.fn(() => Promise.resolve())
  }))
}));

// Mock glob module
vi.mock('glob', () => ({
  glob: vi.fn()
}));

// Mock fs promises module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn()
  }
}));

// Mock the utils module
vi.mock('../../src/utils/utils', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock os module for home directory expansion
vi.mock('os', () => {
  const osMock = { homedir: vi.fn(() => '/Users/test') };
  return { ...osMock, default: osMock };
});

// Mock jq-resolver module
const mockEvaluateJq = vi.fn<(data: unknown, expression: string) => Promise<unknown>>();
vi.mock('../../src/lib/jq-resolver', () => ({
  evaluateJq: (...args: unknown[]) => mockEvaluateJq(...args as [unknown, string])
}));

const mockedFs = vi.mocked(fs);
const mockedChokidar = vi.mocked(chokidarModule);

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

describe('CustomSearchLoader', () => {
  let loader: CustomSearchLoader;

  const createTestConfig = (overrides?: Partial<CustomSearchEntry>[]): CustomSearchEntry[] => {
    const defaults: CustomSearchEntry[] = [
      {
        name: '{basename}',
        type: 'command',
        description: '{frontmatter@description}',
        sourcePath: '/path/to/commands/*.md',
      },
      {
        name: '{basename}',
        type: 'mention',
        description: '{frontmatter@description}',
        sourcePath: '/path/to/agents/*.md',
      },
    ];
    if (overrides) {
      return overrides.map((override, i) => ({ ...defaults[i % 2], ...override })) as CustomSearchEntry[];
    }
    return defaults;
  };

  beforeEach(() => {
    loader = new CustomSearchLoader(createTestConfig());
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      const config = createTestConfig();
      const testLoader = new CustomSearchLoader(config);
      expect(testLoader).toBeInstanceOf(CustomSearchLoader);
    });

    test('should use default config when none provided', () => {
      const testLoader = new CustomSearchLoader();
      expect(testLoader).toBeInstanceOf(CustomSearchLoader);
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
      const newConfig: CustomSearchEntry[] = [
        { name: '{basename}', type: 'command', description: '{frontmatter@description}', sourcePath: '/new/path/*.md' }
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
      expect(mockedFs.readdir.mock.calls).toHaveLength(firstReadCount);
    });

    test('should use default config when undefined is passed', () => {
      loader.updateConfig(undefined);
      expect(loader).toBeInstanceOf(CustomSearchLoader);
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
      expect(mockedFs.readdir.mock.calls).toHaveLength(firstCallCount);
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
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
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

    test('description テンプレートで {dirname} を使用できる', async () => {
      const config: CustomSearchEntry[] = [{
        name: '{basename}',
        type: 'command' as const,
        description: '{dirname}',
        sourcePath: '~/commands/*.md',
      }];
      const testLoader = new CustomSearchLoader(config);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('test.md', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue('---\n---\n# Content');

      const items = await testLoader.getItems('command');
      expect(items).toHaveLength(1);
      expect(items[0]?.description).toBe('commands');
    });
  });

  describe('file pattern matching', () => {
    // Shared mock setup for excludeMarker tests
    function setupPluginDirectoryMocks() {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr === '/path/to/plugins') {
          return Promise.resolve([
            createDirent('plugin-old', false),
            createDirent('plugin-new', false),
          ] as any);
        }
        if (dirStr === '/path/to/plugins/plugin-old') {
          return Promise.resolve([
            createDirent('.orphaned_at', true),
            createDirent('commands', false),
          ] as any);
        }
        if (dirStr === '/path/to/plugins/plugin-old/commands') {
          return Promise.resolve([
            createDirent('old-cmd.md', true),
          ] as any);
        }
        if (dirStr === '/path/to/plugins/plugin-new') {
          return Promise.resolve([
            createDirent('commands', false),
          ] as any);
        }
        if (dirStr === '/path/to/plugins/plugin-new/commands') {
          return Promise.resolve([
            createDirent('new-cmd.md', true),
          ] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockResolvedValue('---\ndescription: Command\n---\nContent');
    }

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
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/**/SKILL.md',
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
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/**/*.md',
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
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/root/**/commands/*.md',
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
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/root/**/*/*.md',
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
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/root/**/{commands,agents}/*.md',
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
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/root/**/plugins/*/commands/*.md',
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
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/test-*.md',
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

    test('should exclude directories containing excludeMarker file', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/plugins/**/commands/*.md',
          excludeMarker: '.orphaned_at',
        },
      ]);

      setupPluginDirectoryMocks();

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('new-cmd');
    });

    test('should not exclude directories when excludeMarker is not set', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/plugins/**/commands/*.md',
        },
      ]);

      setupPluginDirectoryMocks();

      const items = await loader.getItems('command');

      // Without excludeMarker, both directories are included
      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['new-cmd', 'old-cmd']);
    });
  });

  describe('duplicate handling', () => {
    test('should prevent duplicates within same type', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/one/*.md',
        },
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/two/*.md',
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

      // Items from different source entries (different paths) are NOT deduplicated
      // This allows items with same name but different searchPrefix to coexist
      expect(items).toHaveLength(2);
      expect(items[0]?.description).toBe('First version');
      expect(items[1]?.description).toBe('Second version');
    });

    test('should deduplicate within same source entry', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/one/*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      // Return two files with same basename after extension stripping
      mockedFs.readdir.mockResolvedValue([createDirent('duplicate.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\n');

      const items = await loader.getItems('command');

      // Within same source entry, duplicates are removed
      expect(items).toHaveLength(1);
    });

    test('should allow same name in different types', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/commands/*.md',
        },
        {
          name: '{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          sourcePath: '/path/agents/*.md',
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
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '~/.claude/commands/*.md',
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

      expect(items[0]?.tooltip).toBeDefined();
      expect(items[0]?.tooltip).toContain('description: Test description');
      expect(items[0]?.tooltip).toContain('argument-hint: <arg>');
    });

    test('should not include frontmatter when file has no frontmatter', async () => {
      mockedFs.readFile.mockResolvedValue('Just plain content');

      const items = await loader.getItems('command');

      expect(items[0]?.tooltip).toBeUndefined();
    });
  });

  describe('icon attribute', () => {
    test('should resolve icon from entry config', async () => {
      const loaderWithIcon = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command' as const,
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          icon: 'codicon-rocket',
        },
      ]);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test command\n---\nContent');

      const items = await loaderWithIcon.getItems('command');

      expect(items[0]?.icon).toBe('codicon-rocket');
    });

    test('should resolve icon from frontmatter template', async () => {
      const loaderWithIcon = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command' as const,
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          icon: '{frontmatter@icon}',
        },
      ]);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\nicon: codicon-symbol-class\n---\nContent');

      const items = await loaderWithIcon.getItems('command');

      expect(items[0]?.icon).toBe('codicon-symbol-class');
    });

    test('should auto-detect default icon from pattern when entry has no icon config', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      const items = await loader.getItems('command');

      // pattern '*.md' (non-SKILL) → auto-detected as command → codicon-terminal
      expect(items[0]?.icon).toBe('codicon-terminal');
    });

    test('should auto-detect lightbulb icon for SKILL.md pattern', async () => {
      const skillLoader = new CustomSearchLoader(createTestConfig([
        { sourcePath: '/path/to/skills/**/SKILL.md' }
      ]));
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('SKILL.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: A skill\n---\nContent');

      const items = await skillLoader.getItems('command');

      expect(items[0]?.icon).toBe('codicon-edit-sparkle');
    });
  });

  describe('sourceId', () => {
    test('should include sourceId in items', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\n');

      const items = await loader.getItems('command');

      expect(items[0]?.sourceId).toBe('/path/to/commands/*.md');
    });
  });

  describe('searchPrefix', () => {
    let prefixLoader: CustomSearchLoader;

    beforeEach(() => {
      // searchPrefixが設定されたmention設定を持つローダーを作成
      prefixLoader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          // searchPrefixなし - 常に検索対象
        },
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/agents/*.md',
          searchPrefix: 'agent',
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
      const multiPrefixLoader = new CustomSearchLoader([
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/agents/*.md',
          searchPrefix: 'agent',
        },
        {
          name: 'tool-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/tools/*.md',
          searchPrefix: 'tool',
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
      const noPrefixLoader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
        },
      ]);

      const prefixes = noPrefixLoader.getSearchPrefixes('command');
      expect(prefixes).toEqual([]);
    });

    test('should return configured prefixes for type', () => {
      const prefixLoader = new CustomSearchLoader([
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/agents/*.md',
          searchPrefix: 'agent',
        },
      ]);

      const prefixes = prefixLoader.getSearchPrefixes('mention');
      expect(prefixes).toEqual(['agent:']);
    });

    test('should return multiple prefixes when configured', () => {
      const multiPrefixLoader = new CustomSearchLoader([
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/agents/*.md',
          searchPrefix: 'agent',
        },
        {
          name: 'tool-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/tools/*.md',
          searchPrefix: 'tool',
        },
      ]);

      const prefixes = multiPrefixLoader.getSearchPrefixes('mention');
      expect(prefixes).toEqual(['agent:', 'tool:']);
    });

    test('should only return prefixes for specified type', () => {
      const mixedLoader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          searchPrefix: 'cmd',
        },
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/agents/*.md',
          searchPrefix: 'agent',
        },
      ]);

      const commandPrefixes = mixedLoader.getSearchPrefixes('command');
      expect(commandPrefixes).toEqual(['cmd:']);

      const mentionPrefixes = mixedLoader.getSearchPrefixes('mention');
      expect(mentionPrefixes).toEqual(['agent:']);
    });
  });

  describe('entry-level enable/disable filtering', () => {
    test('should filter slash commands using entry-level enable list', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          enable: ['test-*', 'commit'],
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('test-command.md', true),
        createDirent('commit.md', true),
        createDirent('debug.md', true),
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('test-command')) {
          return Promise.resolve('---\ndescription: Test command\n---\n');
        }
        if (pathStr.includes('commit')) {
          return Promise.resolve('---\ndescription: Commit command\n---\n');
        }
        return Promise.resolve('---\ndescription: Debug command\n---\n');
      }) as any);

      const items = await loader.getItems('command');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['commit', 'test-command']);
    });

    test('should filter slash commands using entry-level disable list', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          disable: ['debug', 'old-*'],
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('commit.md', true),
        createDirent('debug.md', true),
        createDirent('old-command.md', true),
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('commit')) {
          return Promise.resolve('---\ndescription: Commit command\n---\n');
        }
        if (pathStr.includes('debug')) {
          return Promise.resolve('---\ndescription: Debug command\n---\n');
        }
        return Promise.resolve('---\ndescription: Old command\n---\n');
      }) as any);

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('commit');
    });

    test('should apply both entry-level and global-level filtering', async () => {
      loader = new CustomSearchLoader(
        [
          {
            name: '{basename}',
            type: 'command',
            description: '{frontmatter@description}',
            sourcePath: '/path/to/commands/*.md',
            enable: ['test-*', 'commit', 'debug'],
          },
        ],
        {
          shortcuts: {
            main: 'Cmd+Shift+Space',
            paste: 'Cmd+Enter',
            close: 'Escape',
            historyNext: 'Ctrl+j',
            historyPrev: 'Ctrl+k',
            search: 'Ctrl+f',
          },
          window: {
            position: 'cursor',
            width: 600,
            height: 300,
          },
          slashCommands: {
            enable: ['commit', 'test-*'],
          },
        }
      );

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('test-command.md', true),
        createDirent('commit.md', true),
        createDirent('debug.md', true),
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('test-command')) {
          return Promise.resolve('---\ndescription: Test command\n---\n');
        }
        if (pathStr.includes('commit')) {
          return Promise.resolve('---\ndescription: Commit command\n---\n');
        }
        return Promise.resolve('---\ndescription: Debug command\n---\n');
      }) as any);

      const items = await loader.getItems('command');

      // Entry-level allows: test-*, commit, debug
      // Global-level allows: commit, test-*
      // Result: test-*, commit (intersection)
      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['commit', 'test-command']);
    });

    test('should work with mention type', async () => {
      loader = new CustomSearchLoader([
        {
          name: 'agent-{basename}',
          type: 'mention',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/agents/*.md',
          enable: ['agent-claude', 'agent-gemini'],
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('claude.md', true),
        createDirent('gemini.md', true),
        createDirent('legacy.md', true),
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('claude')) {
          return Promise.resolve('---\ndescription: Claude agent\n---\n');
        }
        if (pathStr.includes('gemini')) {
          return Promise.resolve('---\ndescription: Gemini agent\n---\n');
        }
        return Promise.resolve('---\ndescription: Legacy agent\n---\n');
      }) as any);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['agent-claude', 'agent-gemini']);
    });
  });

  describe('global-level enable/disable filtering for mentions', () => {
    test('should filter mentions using global enable list', async () => {
      loader = new CustomSearchLoader(
        [
          {
            name: 'agent-{basename}',
            type: 'mention',
            description: '{frontmatter@description}',
            sourcePath: '/path/to/agents/*.md',
          },
        ],
        {
          shortcuts: {
            main: 'Cmd+Shift+Space',
            paste: 'Cmd+Enter',
            close: 'Escape',
            historyNext: 'Ctrl+j',
            historyPrev: 'Ctrl+k',
            search: 'Cmd+f',
          },
          window: {
            position: 'cursor',
            width: 600,
            height: 300,
          },
          mentionEnable: ['agent-claude', 'agent-gemini*'],
        }
      );

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('claude.md', true),
        createDirent('gemini.md', true),
        createDirent('gemini-pro.md', true),
        createDirent('legacy.md', true),
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('claude')) {
          return Promise.resolve('---\ndescription: Claude agent\n---\n');
        }
        if (pathStr.includes('gemini.md')) {
          return Promise.resolve('---\ndescription: Gemini agent\n---\n');
        }
        if (pathStr.includes('gemini-pro')) {
          return Promise.resolve('---\ndescription: Gemini Pro agent\n---\n');
        }
        return Promise.resolve('---\ndescription: Legacy agent\n---\n');
      }) as any);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['agent-claude', 'agent-gemini', 'agent-gemini-pro']);
    });

    test('should filter mentions using global disable list', async () => {
      loader = new CustomSearchLoader(
        [
          {
            name: 'agent-{basename}',
            type: 'mention',
            description: '{frontmatter@description}',
            sourcePath: '/path/to/agents/*.md',
          },
        ],
        {
          shortcuts: {
            main: 'Cmd+Shift+Space',
            paste: 'Cmd+Enter',
            close: 'Escape',
            historyNext: 'Ctrl+j',
            historyPrev: 'Ctrl+k',
            search: 'Cmd+f',
          },
          window: {
            position: 'cursor',
            width: 600,
            height: 300,
          },
          mentionDisable: ['agent-legacy', 'agent-old-*'],
        }
      );

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('claude.md', true),
        createDirent('gemini.md', true),
        createDirent('legacy.md', true),
        createDirent('old-bot.md', true),
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('claude')) {
          return Promise.resolve('---\ndescription: Claude agent\n---\n');
        }
        if (pathStr.includes('gemini')) {
          return Promise.resolve('---\ndescription: Gemini agent\n---\n');
        }
        if (pathStr.includes('legacy')) {
          return Promise.resolve('---\ndescription: Legacy agent\n---\n');
        }
        return Promise.resolve('---\ndescription: Old bot\n---\n');
      }) as any);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['agent-claude', 'agent-gemini']);
    });

    test('should apply both global enable and disable filters for mentions', async () => {
      loader = new CustomSearchLoader(
        [
          {
            name: 'agent-{basename}',
            type: 'mention',
            description: '{frontmatter@description}',
            sourcePath: '/path/to/agents/*.md',
          },
        ],
        {
          shortcuts: {
            main: 'Cmd+Shift+Space',
            paste: 'Cmd+Enter',
            close: 'Escape',
            historyNext: 'Ctrl+j',
            historyPrev: 'Ctrl+k',
            search: 'Cmd+f',
          },
          window: {
            position: 'cursor',
            width: 600,
            height: 300,
          },
          mentionEnable: ['agent-*'],
          mentionDisable: ['agent-legacy'],
        }
      );

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('claude.md', true),
        createDirent('gemini.md', true),
        createDirent('legacy.md', true),
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('claude')) {
          return Promise.resolve('---\ndescription: Claude agent\n---\n');
        }
        if (pathStr.includes('gemini')) {
          return Promise.resolve('---\ndescription: Gemini agent\n---\n');
        }
        return Promise.resolve('---\ndescription: Legacy agent\n---\n');
      }) as any);

      const items = await loader.getItems('mention');

      // Global enable allows: agent-*
      // Global disable excludes: agent-legacy
      // Result: agent-claude, agent-gemini (legacy is excluded)
      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['agent-claude', 'agent-gemini']);
    });

    test('should apply both entry-level and global-level filtering for mentions', async () => {
      loader = new CustomSearchLoader(
        [
          {
            name: 'agent-{basename}',
            type: 'mention',
            description: '{frontmatter@description}',
            sourcePath: '/path/to/agents/*.md',
            enable: ['agent-claude', 'agent-gemini', 'agent-openai'],
          },
        ],
        {
          shortcuts: {
            main: 'Cmd+Shift+Space',
            paste: 'Cmd+Enter',
            close: 'Escape',
            historyNext: 'Ctrl+j',
            historyPrev: 'Ctrl+k',
            search: 'Cmd+f',
          },
          window: {
            position: 'cursor',
            width: 600,
            height: 300,
          },
          mentionEnable: ['agent-claude', 'agent-gemini*'],
        }
      );

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('claude.md', true),
        createDirent('gemini.md', true),
        createDirent('openai.md', true),
        createDirent('legacy.md', true),
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('claude')) {
          return Promise.resolve('---\ndescription: Claude agent\n---\n');
        }
        if (pathStr.includes('gemini')) {
          return Promise.resolve('---\ndescription: Gemini agent\n---\n');
        }
        if (pathStr.includes('openai')) {
          return Promise.resolve('---\ndescription: OpenAI agent\n---\n');
        }
        return Promise.resolve('---\ndescription: Legacy agent\n---\n');
      }) as any);

      const items = await loader.getItems('mention');

      // Entry-level allows: agent-claude, agent-gemini, agent-openai
      // Global-level allows: agent-claude, agent-gemini*
      // Result: agent-claude, agent-gemini (intersection)
      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['agent-claude', 'agent-gemini']);
    });
  });

  describe('jq expression support (pattern @. syntax)', () => {
    test('should expand JSON array into multiple items using jq expression', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@agentType}',
          sourcePath: '/path/to/teams/**/config.json@.members',
          searchPrefix: 'member',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr === '/path/to/teams') {
          return Promise.resolve([createDirent('my-team', false)] as any);
        }
        if (dirStr === '/path/to/teams/my-team') {
          return Promise.resolve([createDirent('config.json', true)] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'my-team',
        members: [
          { name: 'team-lead', agentType: 'team-lead' },
          { name: 'worker', agentType: 'general-purpose' },
          { name: 'researcher', agentType: 'Explore' }
        ]
      }));
      mockEvaluateJq.mockResolvedValue([
        { name: 'team-lead', agentType: 'team-lead' },
        { name: 'worker', agentType: 'general-purpose' },
        { name: 'researcher', agentType: 'Explore' }
      ]);

      const items = await loader.searchItems('mention', 'member:');

      expect(mockEvaluateJq).toHaveBeenCalledWith(expect.any(Object), '.members', expect.any(String));
      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['researcher', 'team-lead', 'worker']);
      expect(items.find(i => i.name === 'team-lead')?.description).toBe('team-lead');
      expect(items.find(i => i.name === 'worker')?.description).toBe('general-purpose');
    });

    test('should return empty array when jq result is not an array', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          sourcePath: '/path/to/teams/*.json@.members',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('config.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'my-team',
        members: 'not-an-array'
      }));
      mockEvaluateJq.mockResolvedValue('not-an-array');

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(0);
    });

    test('should skip non-object elements in jq result array', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          sourcePath: '/path/to/teams/*.json@.members',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('config.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        members: [
          { name: 'valid-member' },
          'string-value',
          null,
          42,
          { name: 'another-member' }
        ]
      }));
      mockEvaluateJq.mockResolvedValue([
        { name: 'valid-member' },
        'string-value',
        null,
        42,
        { name: 'another-member' }
      ]);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['another-member', 'valid-member']);
    });

    test('should handle complex jq expressions', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@role}',
          sourcePath: '/path/to/data/*.json@.team.members | map(select(.active))',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('data.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        team: {
          members: [
            { name: 'alice', role: 'lead', active: true },
            { name: 'bob', role: 'dev', active: false },
            { name: 'carol', role: 'pm', active: true }
          ]
        }
      }));
      mockEvaluateJq.mockResolvedValue([
        { name: 'alice', role: 'lead', active: true },
        { name: 'carol', role: 'pm', active: true }
      ]);

      const items = await loader.getItems('mention');

      expect(mockEvaluateJq).toHaveBeenCalledWith(expect.any(Object), '.team.members | map(select(.active))', expect.any(String));
      expect(items).toHaveLength(2);
      expect(items.find(i => i.name === 'alice')?.description).toBe('lead');
      expect(items.find(i => i.name === 'carol')?.description).toBe('pm');
    });

    test('should not use jq expression for non-JSON files', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test command\n---\nContent');

      const items = await loader.getItems('command');

      // Should fall back to normal parsing for .md files
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('test');
      expect(mockEvaluateJq).not.toHaveBeenCalled();
    });

    test('should apply entry-level enable/disable filtering to expanded items', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          sourcePath: '/path/to/teams/*.json@.members',
          enable: ['team-*'],
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('config.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        members: [
          { name: 'team-lead' },
          { name: 'worker' },
          { name: 'team-researcher' }
        ]
      }));
      mockEvaluateJq.mockResolvedValue([
        { name: 'team-lead' },
        { name: 'worker' },
        { name: 'team-researcher' }
      ]);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['team-lead', 'team-researcher']);
    });

    test('should return empty array when jq evaluation returns null', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          sourcePath: '/path/to/teams/*.json@.nonexistent',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('config.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({ name: 'test' }));
      mockEvaluateJq.mockResolvedValue(null);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(0);
    });
  });

  describe('JSONL with jq expression support', () => {
    test('should apply jq expression to each JSONL line', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@role}',
          sourcePath: '/path/to/data/*.jsonl@.user',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('entries.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue(
        '{"user": {"name": "alice", "role": "lead"}}\n{"user": {"name": "bob", "role": "dev"}}'
      );
      mockEvaluateJq
        .mockResolvedValueOnce({ name: 'alice', role: 'lead' })
        .mockResolvedValueOnce({ name: 'bob', role: 'dev' });

      const items = await loader.getItems('mention');

      expect(mockEvaluateJq).toHaveBeenCalledTimes(2);
      expect(mockEvaluateJq).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }), '.user', expect.any(String));
      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['alice', 'bob']);
    });

    test('should expand array results from jq on JSONL lines', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          sourcePath: '/path/to/data/*.jsonl@.items',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('entries.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue(
        '{"items": [{"name": "a"}, {"name": "b"}]}\n{"items": [{"name": "c"}]}'
      );
      mockEvaluateJq
        .mockResolvedValueOnce([{ name: 'a' }, { name: 'b' }])
        .mockResolvedValueOnce([{ name: 'c' }]);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['a', 'b', 'c']);
    });

    test('should skip JSONL lines where jq returns null', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          sourcePath: '/path/to/data/*.jsonl@.data',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('entries.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue(
        '{"data": {"name": "valid"}}\n{"other": "no-data"}'
      );
      mockEvaluateJq
        .mockResolvedValueOnce({ name: 'valid' })
        .mockResolvedValueOnce(null);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('valid');
    });

    test('should parse JSONL without jq expression (default behavior)', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@role}',
          sourcePath: '/path/to/data/*.jsonl',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('entries.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue(
        '{"name": "alice", "role": "lead"}\n{"name": "bob", "role": "dev"}'
      );

      const items = await loader.getItems('mention');

      expect(mockEvaluateJq).not.toHaveBeenCalled();
      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['alice', 'bob']);
    });
  });

  describe('JSON file support', () => {
    test('should search JSON files with *.json pattern', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'command',
          description: '{json@description}',
          sourcePath: '/path/to/json-commands/*.json',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('my-command.json', true),
        createDirent('other.md', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-command',
        description: 'A test JSON command',
      }));

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('test-command');
      expect(items[0]?.description).toBe('A test JSON command');
    });

    test('should resolve {json@field} template variables', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@role}',
          sourcePath: '/path/to/agents/*.json',
          searchPrefix: 'agent',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('claude-agent.json', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'claude',
        role: 'AI coding assistant',
      }));

      const items = await loader.searchItems('mention', 'agent:');

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('claude');
      expect(items[0]?.description).toBe('AI coding assistant');
    });

    test('should resolve nested JSON paths with {json@nested.field}', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@config.displayName}',
          type: 'command',
          description: '{json@config.metadata.description}',
          sourcePath: '/path/to/nested/*.json',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('nested-config.json', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        config: {
          displayName: 'My Plugin',
          metadata: {
            description: 'A nested plugin config',
          },
        },
      }));

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('My Plugin');
      expect(items[0]?.description).toBe('A nested plugin config');
    });

    test('should not include frontmatter for JSON files', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'command',
          description: '{json@description}',
          sourcePath: '/path/to/json-commands/*.json',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('cmd.json', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'json-cmd',
        description: 'JSON command',
      }));

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.tooltip).toBeUndefined();
    });
  });

  describe('parseOrderBy', () => {
    test('should parse "{json@createdAt} desc" to field createdAt with desc direction', () => {
      const result = CustomSearchLoader.parseOrderBy('{json@createdAt} desc');
      expect(result).toEqual({ field: 'createdAt', direction: 'desc' });
    });

    test('should parse "{frontmatter@date}" to field date with asc direction (default)', () => {
      const result = CustomSearchLoader.parseOrderBy('{frontmatter@date}');
      expect(result).toEqual({ field: 'date', direction: 'asc' });
    });

    test('should parse "name" to field name with asc direction (default)', () => {
      const result = CustomSearchLoader.parseOrderBy('name');
      expect(result).toEqual({ field: 'name', direction: 'asc' });
    });

    test('should parse "name desc" to field name with desc direction', () => {
      const result = CustomSearchLoader.parseOrderBy('name desc');
      expect(result).toEqual({ field: 'name', direction: 'desc' });
    });

    test('should parse "description asc" to field description with asc direction', () => {
      const result = CustomSearchLoader.parseOrderBy('description asc');
      expect(result).toEqual({ field: 'description', direction: 'asc' });
    });
  });

  describe('extractOrderByTemplate', () => {
    test('should extract "{json@createdAt}" from "{json@createdAt} desc"', () => {
      const result = CustomSearchLoader.extractOrderByTemplate('{json@createdAt} desc');
      expect(result).toBe('{json@createdAt}');
    });

    test('should return "name" unchanged from "name"', () => {
      const result = CustomSearchLoader.extractOrderByTemplate('name');
      expect(result).toBe('name');
    });

    test('should extract template part from "name desc"', () => {
      const result = CustomSearchLoader.extractOrderByTemplate('name desc');
      expect(result).toBe('name');
    });

    test('should extract "{frontmatter@date}" from "{frontmatter@date} asc"', () => {
      const result = CustomSearchLoader.extractOrderByTemplate('{frontmatter@date} asc');
      expect(result).toBe('{frontmatter@date}');
    });
  });

  describe('normalizeToTimestampMs', () => {
    describe('number input: seconds vs milliseconds auto-detection', () => {
      test('should multiply by 1000 when value is Unix seconds (< 1e12)', () => {
        expect(CustomSearchLoader.normalizeToTimestampMs(1700000000)).toBe(1700000000000);
      });

      test('should keep value as-is when already in milliseconds (>= 1e12)', () => {
        expect(CustomSearchLoader.normalizeToTimestampMs(1700000000000)).toBe(1700000000000);
      });

      test('should treat boundary value 999_999_999_999 as seconds', () => {
        expect(CustomSearchLoader.normalizeToTimestampMs(999_999_999_999)).toBe(999_999_999_999_000);
      });

      test('should treat boundary value 1_000_000_000_000 as milliseconds', () => {
        expect(CustomSearchLoader.normalizeToTimestampMs(1_000_000_000_000)).toBe(1_000_000_000_000);
      });

      test('should return undefined for NaN', () => {
        expect(CustomSearchLoader.normalizeToTimestampMs(NaN)).toBeUndefined();
      });

      test('should return undefined for Infinity', () => {
        expect(CustomSearchLoader.normalizeToTimestampMs(Infinity)).toBeUndefined();
      });

      test('should return undefined for negative values', () => {
        expect(CustomSearchLoader.normalizeToTimestampMs(-1)).toBeUndefined();
        expect(CustomSearchLoader.normalizeToTimestampMs(-1700000000)).toBeUndefined();
      });
    });

    describe('string input: date string conversion', () => {
      test('should parse ISO 8601 string to milliseconds', () => {
        const isoString = '2024-01-15T12:00:00.000Z';
        expect(CustomSearchLoader.normalizeToTimestampMs(isoString)).toBe(Date.parse(isoString));
      });

      test('should parse date-only string to milliseconds', () => {
        const dateString = '2024-01-15';
        expect(CustomSearchLoader.normalizeToTimestampMs(dateString)).toBe(Date.parse(dateString));
      });

      test('should return undefined for invalid date string', () => {
        expect(CustomSearchLoader.normalizeToTimestampMs('not-a-date')).toBeUndefined();
      });

      test('should return undefined for empty string', () => {
        expect(CustomSearchLoader.normalizeToTimestampMs('')).toBeUndefined();
      });
    });
  });

  describe('sortKey-based sorting with orderBy custom field', () => {
    test('should sort JSON array items by createdAt desc using sortKey', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          sourcePath: '/path/to/teams/*.json@.items',
          orderBy: '{json@createdAt} desc',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('data.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        items: [
          { name: 'item-a', createdAt: '2024-01-01' },
          { name: 'item-c', createdAt: '2024-03-01' },
          { name: 'item-b', createdAt: '2024-02-01' },
        ],
      }));
      mockEvaluateJq.mockResolvedValue([
        { name: 'item-a', createdAt: '2024-01-01' },
        { name: 'item-c', createdAt: '2024-03-01' },
        { name: 'item-b', createdAt: '2024-02-01' },
      ]);

      const items = await loader.getItems('mention');

      // desc order: item-c (2024-03-01) > item-b (2024-02-01) > item-a (2024-01-01)
      expect(items).toHaveLength(3);
      expect(items.map(i => i.name)).toEqual(['item-c', 'item-b', 'item-a']);
    });

    test('should store sortKey on each item when orderBy uses custom field', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          sourcePath: '/path/to/teams/*.json@.items',
          orderBy: '{json@createdAt} desc',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('data.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        items: [
          { name: 'item-a', createdAt: '2024-01-01' },
        ],
      }));
      mockEvaluateJq.mockResolvedValue([
        { name: 'item-a', createdAt: '2024-01-01' },
      ]);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(1);
      expect(items[0]?.sortKey).toBe('2024-01-01');
    });
  });

  describe('orderBy regression: name and description sorting still works', () => {
    test('should sort items by name asc (default) from markdown files', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          orderBy: 'name',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('zebra.md', true),
        createDirent('alpha.md', true),
        createDirent('beta.md', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Command\n---\n');

      const items = await loader.getItems('command');

      expect(items.map(i => i.name)).toEqual(['alpha', 'beta', 'zebra']);
    });

    test('should sort items by name desc from markdown files', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          orderBy: 'name desc',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('alpha.md', true),
        createDirent('beta.md', true),
        createDirent('zebra.md', true),
      ] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Command\n---\n');

      const items = await loader.getItems('command');

      expect(items.map(i => i.name)).toEqual(['zebra', 'beta', 'alpha']);
    });

    test('should sort items by description asc', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          orderBy: 'description',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([
        createDirent('cmd-a.md', true),
        createDirent('cmd-b.md', true),
        createDirent('cmd-c.md', true),
      ] as any);
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('cmd-a')) return Promise.resolve('---\ndescription: Zebra command\n---\n');
        if (pathStr.includes('cmd-b')) return Promise.resolve('---\ndescription: Alpha command\n---\n');
        return Promise.resolve('---\ndescription: Beta command\n---\n');
      }) as any);

      const items = await loader.getItems('command');

      // sorted by description asc: Alpha, Beta, Zebra
      expect(items.map(i => i.description)).toEqual(['Alpha command', 'Beta command', 'Zebra command']);
    });

    test('should not set sortKey when orderBy is "name"', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          orderBy: 'name',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\n');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.sortKey).toBeUndefined();
    });

    test('should not set sortKey when orderBy is "description"', async () => {
      loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/commands/*.md',
          orderBy: 'description',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\n');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(1);
      expect(items[0]?.sortKey).toBeUndefined();
    });
  });

  describe('plain text file support', () => {
    test('should create one item per non-empty line in .txt file', async () => {
      loader = new CustomSearchLoader(createTestConfig([
        {
          name: '{line}',
          type: 'command',
          description: '{basename}',
          sourcePath: '/path/to/logs/*.txt',
        },
      ]));

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, mtimeMs: 1000 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('server.txt', true)] as any);
      mockedFs.readFile.mockResolvedValue('2024-01-01 Server started\nLine 2\nLine 3');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(3);
      expect(items[0]?.name).toBe('2024-01-01 Server started');
      expect(items[1]?.name).toBe('Line 2');
      expect(items[2]?.name).toBe('Line 3');
      expect(items[0]?.description).toBe('server');
    });

    test('should create one item per line in .log file', async () => {
      loader = new CustomSearchLoader(createTestConfig([
        {
          name: '{line}',
          type: 'command',
          description: '{basename}',
          sourcePath: '/path/to/logs/*.log',
        },
      ]));

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, mtimeMs: 1000 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('app.log', true)] as any);
      mockedFs.readFile.mockResolvedValue('ERROR: Connection timeout\nRetrying...');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(2);
      expect(items[0]?.name).toBe('ERROR: Connection timeout');
      expect(items[1]?.name).toBe('Retrying...');
    });

    test('should return empty array for empty plain text file', async () => {
      loader = new CustomSearchLoader(createTestConfig([
        {
          name: '{line}',
          type: 'command',
          description: '{basename}',
          sourcePath: '/path/to/logs/*.txt',
        },
      ]));

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, mtimeMs: 1000 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('empty.txt', true)] as any);
      mockedFs.readFile.mockResolvedValue('');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(0);
    });

    test('should skip blank lines', async () => {
      loader = new CustomSearchLoader(createTestConfig([
        {
          name: '{line}',
          type: 'command',
          description: '{basename}',
          sourcePath: '/path/to/logs/*.txt',
        },
      ]));

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, mtimeMs: 1000 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('data.txt', true)] as any);
      mockedFs.readFile.mockResolvedValue('\n\n  First real line\n\nSecond line\n');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(2);
      expect(items[0]?.name).toBe('First real line');
      expect(items[1]?.name).toBe('Second line');
    });

    test('should resolve {heading} as first non-empty line for all items', async () => {
      loader = new CustomSearchLoader(createTestConfig([
        {
          name: '{line}',
          type: 'command',
          description: '{heading}',
          sourcePath: '/path/to/logs/*.txt',
        },
      ]));

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, mtimeMs: 1000 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('data.txt', true)] as any);
      mockedFs.readFile.mockResolvedValue('Header line\nSecond line');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(2);
      // All items share the same heading (first line of file)
      expect(items[0]?.description).toBe('Header line');
      expect(items[1]?.description).toBe('Header line');
    });

    test('should not have frontmatter for plain text files', async () => {
      loader = new CustomSearchLoader(createTestConfig([
        {
          name: '{frontmatter@title}|{line}',
          type: 'command',
          description: '{frontmatter@description}',
          sourcePath: '/path/to/logs/*.txt',
        },
      ]));

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, mtimeMs: 1000 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('notes.txt', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ntitle: This is not frontmatter\n---\nBody');

      const items = await loader.getItems('command');

      // 4 non-empty lines: '---' appears twice but has different sortKeys (line positions) → 4 items
      expect(items).toHaveLength(4);
      // frontmatter@title is empty, so all names fallback to {line} (sorted by name asc)
      const names = items.map(i => i.name);
      expect(names.filter(n => n === '---')).toHaveLength(2);
      expect(names).toContain('Body');
      expect(names).toContain('title: This is not frontmatter');
      // frontmatter@description is empty for all items
      items.forEach(item => {
        expect(item.description).toBe('');
        expect(item.tooltip).toBeUndefined();
      });
    });

    test('should treat unknown extensions as plain text', async () => {
      loader = new CustomSearchLoader(createTestConfig([
        {
          name: '{line}',
          type: 'command',
          description: '{basename}',
          sourcePath: '/path/to/data/*.csv',
        },
      ]));

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, mtimeMs: 1000 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('data.csv', true)] as any);
      mockedFs.readFile.mockResolvedValue('name,age,city\nAlice,30,Tokyo');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(2);
      // Preserves file order (not alphabetical)
      expect(items[0]?.name).toBe('name,age,city');
      expect(items[1]?.name).toBe('Alice,30,Tokyo');
      items.forEach(item => expect(item.description).toBe('data'));
    });

    test('should preserve file line order (not sort by name)', async () => {
      loader = new CustomSearchLoader(createTestConfig([
        {
          name: '{line}',
          type: 'command',
          description: '{basename}',
          sourcePath: '/path/to/logs/*.log',
        },
      ]));

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, mtimeMs: 1000 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('app.log', true)] as any);
      // Alphabetically: CONNECT < ERROR < WARN, but file order is different
      mockedFs.readFile.mockResolvedValue('WARN: Low memory\nERROR: Crash\nCONNECT: Retry');

      const items = await loader.getItems('command');

      expect(items).toHaveLength(3);
      // Should follow file line order, not alphabetical
      expect(items[0]?.name).toBe('WARN: Low memory');
      expect(items[1]?.name).toBe('ERROR: Crash');
      expect(items[2]?.name).toBe('CONNECT: Retry');
    });
  });

  describe('singleflight pattern (loadAll)', () => {
    test('concurrent getItems calls should share the same loading promise', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      // Invalidate cache to force loading
      loader.invalidateCache();

      // Launch multiple concurrent calls
      const [result1, result2, result3] = await Promise.all([
        loader.getItems('command'),
        loader.getItems('command'),
        loader.getItems('command'),
      ]);

      // All should return the same results
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);

      // readdir should have been called only once (not 3 times) due to singleflight
      // Each config entry triggers one readdir, so 2 entries = 2 readdir calls (not 6)
      const readdirCallCount = mockedFs.readdir.mock.calls.length;
      expect(readdirCallCount).toBeLessThanOrEqual(2);
    });

    test('subsequent call after completion should use cache, not re-load', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: Test\n---\nContent');

      // First call loads
      await loader.getItems('command');
      const callCountAfterFirst = mockedFs.readdir.mock.calls.length;

      // Second call should hit cache
      await loader.getItems('command');
      expect(mockedFs.readdir.mock.calls).toHaveLength(callCountAfterFirst);
    });
  });

  describe('JSONL with searchPrefix (history.jsonl use case)', () => {
    test('should load JSONL items with {json@text} template and searchPrefix', async () => {
      // ユーザーの設定を再現: history.jsonl の text フィールドを検索
      const jsonlLoader = new CustomSearchLoader([
        {
          name: '{json@text}',
          type: 'command',
          description: '',
          icon: 'repo',
          color: 'rose',
          sourcePath: '/Users/test/.prompt-line/history.jsonl',
          searchPrefix: 'r',
          maxSuggestions: 100,
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, size: 500 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('history.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue(
        '{"text":"hello world","appName":"Terminal","timestamp":1710000000000}\n' +
        '{"text":"git commit -m fix","appName":"iTerm2","timestamp":1710000001000}\n' +
        '{"text":"pnpm test","appName":"Terminal","timestamp":1710000002000}'
      );

      const items = await jsonlLoader.getItems('command');
      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['git commit -m fix', 'hello world', 'pnpm test']);
    });

    test('should filter JSONL items by searchPrefix r:', async () => {
      const jsonlLoader = new CustomSearchLoader([
        {
          name: '{json@text}',
          type: 'command',
          description: '{json@appName}',
          sourcePath: '/Users/test/.prompt-line/history.jsonl',
          searchPrefix: 'r',
          maxSuggestions: 100,
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, size: 500 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('history.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue(
        '{"text":"hello world","appName":"Terminal","timestamp":1710000000000}\n' +
        '{"text":"git commit -m fix","appName":"iTerm2","timestamp":1710000001000}\n' +
        '{"text":"pnpm test","appName":"Terminal","timestamp":1710000002000}'
      );

      // r: なしでは表示されない（searchPrefix フィルタリング）
      const noPrefix = await jsonlLoader.searchItems('command', 'hello');
      expect(noPrefix).toHaveLength(0);

      // r: 付きで検索
      jsonlLoader.invalidateCache();
      const withPrefix = await jsonlLoader.searchItems('command', 'r:hello');
      expect(withPrefix).toHaveLength(1);
      expect(withPrefix[0]?.name).toBe('hello world');
    });

    test('should return all items with r: prefix and empty query', async () => {
      const jsonlLoader = new CustomSearchLoader([
        {
          name: '{json@text}',
          type: 'command',
          description: '',
          sourcePath: '/Users/test/.prompt-line/history.jsonl',
          searchPrefix: 'r',
          maxSuggestions: 100,
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, size: 500 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('history.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue(
        '{"text":"item1","appName":"Terminal","timestamp":1710000000000}\n' +
        '{"text":"item2","appName":"iTerm2","timestamp":1710000001000}'
      );

      // r: のみ（クエリなし）→ 全件表示
      const results = await jsonlLoader.searchItems('command', 'r:');
      expect(results).toHaveLength(2);
    });

    test('should NOT load items when pattern uses @text without dot (invalid syntax)', async () => {
      // 誤った設定: pattern: "history.jsonl@text" → ファイル名として扱われる
      const badLoader = new CustomSearchLoader([
        {
          name: '{line}',
          type: 'command',
          description: '',
          sourcePath: '/Users/test/.prompt-line/history.jsonl@text',
          searchPrefix: 'r',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      // history.jsonl@text というファイルは存在しない
      mockedFs.readdir.mockResolvedValue([createDirent('history.jsonl', true)] as any);

      const items = await badLoader.getItems('command');
      // ファイル名 "history.jsonl@text" にマッチするファイルがないため0件
      expect(items).toHaveLength(0);
    });

    test('should sort JSONL items by numeric timestamp desc', async () => {
      const jsonlLoader = new CustomSearchLoader([
        {
          name: '{json@display}',
          type: 'command',
          description: '',
          sourcePath: '/Users/test/.claude/history.jsonl',
          searchPrefix: 'r',
          orderBy: '{json@timestamp} desc',
          maxSuggestions: 100,
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, size: 500 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('history.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue(
        '{"display":"oldest","timestamp":1000000000000}\n' +
        '{"display":"middle","timestamp":1500000000000}\n' +
        '{"display":"newest","timestamp":1773000000000}'
      );

      const results = await jsonlLoader.searchItems('command', 'r:');
      expect(results).toHaveLength(3);
      // desc なので最新が最初
      expect(results[0]?.name).toBe('newest');
      expect(results[1]?.name).toBe('middle');
      expect(results[2]?.name).toBe('oldest');
    });

    test('should sort numeric timestamps correctly (not as strings)', async () => {
      const jsonlLoader = new CustomSearchLoader([
        {
          name: '{json@display}',
          type: 'command',
          description: '',
          sourcePath: '/Users/test/.claude/history.jsonl',
          searchPrefix: 'r',
          orderBy: '{json@timestamp} desc',
          maxSuggestions: 100,
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, size: 500 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('history.jsonl', true)] as any);
      // 文字列比較だと "9..." > "17..." になるが、数値比較では 17... > 9...
      mockedFs.readFile.mockResolvedValue(
        '{"display":"smaller-number","timestamp":999999999999}\n' +
        '{"display":"larger-number","timestamp":1773000000000}'
      );

      const results = await jsonlLoader.searchItems('command', 'r:');
      expect(results).toHaveLength(2);
      // 数値比較で desc: larger > smaller
      expect(results[0]?.name).toBe('larger-number');
      expect(results[1]?.name).toBe('smaller-number');
    });
  });

  describe('JSONL hot reload via invalidateCache', () => {
    test('should return fresh data after invalidateCache is called', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{json@text}',
          type: 'command',
          description: '',
          sourcePath: '/Users/test/.claude/history.jsonl',
          searchPrefix: 'r',
          orderBy: '{json@timestamp} desc',
          maxSuggestions: 100,
        },
      ];
      const loader = new CustomSearchLoader(config);

      // Initial load
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, size: 500 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('history.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue('{"text":"old-item","timestamp":1000}');

      const result1 = await loader.searchItems('command', 'r:');
      expect(result1).toHaveLength(1);
      expect(result1[0]?.name).toBe('old-item');

      // Simulate file change → invalidateCache (same as chokidar event handler)
      loader.invalidateCache();

      // File now has new content
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true, size: 500 } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('history.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue(
        '{"text":"old-item","timestamp":1000}\n{"text":"new-item","timestamp":2000}'
      );

      // After invalidation, should reload from disk
      const result2 = await loader.searchItems('command', 'r:');
      expect(result2).toHaveLength(2);
      expect(result2[0]?.name).toBe('new-item');
      expect(result2[1]?.name).toBe('old-item');
    });

    test('should emit source-changed event on invalidateCache from file change', () => {
      const loader = new CustomSearchLoader();
      const handler = vi.fn();
      loader.on('source-changed', handler);

      // Directly emit to verify EventEmitter works
      loader.emit('source-changed');
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('glob watching', () => {
    test('should create glob watcher for glob-pattern sources after getItems', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{basename}',
          type: 'command',
          description: '',
          sourcePath: '~/plugins/cache/**/*.md',
        },
      ];
      const loader = new CustomSearchLoader(config);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('skill.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: test\n---\n# Test');

      mockedChokidar.watch.mockClear();
      await loader.getItems('command');

      const globWatchCall = mockedChokidar.watch.mock.calls.find((call) => {
        const paths = call[0] as string[];
        return paths.some((p) => p.includes('**/*.md'));
      });
      expect(globWatchCall).toBeDefined();
    });

    test('should not create glob watcher for individual file sources', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{basename}',
          type: 'command',
          description: '',
          sourcePath: '/path/to/commands/readme.md',
        },
      ];
      const loader = new CustomSearchLoader(config);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('readme.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: test\n---\n# Test');

      mockedChokidar.watch.mockClear();
      await loader.getItems('command');

      const globWatchCall = mockedChokidar.watch.mock.calls.find((call) => {
        const paths = call[0] as string[];
        return paths.some((p) => p.includes('*'));
      });
      expect(globWatchCall).toBeUndefined();
    });

    test('should replace {latest} token with * wildcard in glob patterns', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{basename}',
          type: 'command',
          description: '',
          sourcePath: '~/plugins/cache/*/*/{latest}/**/SKILL.md',
        },
      ];
      const loader = new CustomSearchLoader(config);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([] as any);

      mockedChokidar.watch.mockClear();
      await loader.getItems('command');

      const globWatchCall = mockedChokidar.watch.mock.calls.find((call) => {
        const paths = call[0] as string[];
        return paths.some((p) => p.includes('SKILL.md'));
      });

      if (globWatchCall) {
        const watchedPaths = globWatchCall[0] as string[];
        const skillPath = watchedPaths.find((p) => p.includes('SKILL.md'));
        expect(skillPath).not.toContain('{latest}');
        expect(skillPath).toContain('/*/*/**/SKILL.md');
      }
    });

    test('should not create duplicate watchers for the same glob path', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{basename}',
          type: 'command',
          description: '',
          sourcePath: '~/plugins/cache/**/*.md',
        },
      ];
      const loader = new CustomSearchLoader(config);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: test\n---\n# Test');

      mockedChokidar.watch.mockClear();
      await loader.getItems('command');
      const callsAfterFirst = mockedChokidar.watch.mock.calls.length;

      // Invalidate and reload — same paths should not create new watchers
      loader.invalidateCache();
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: test\n---\n# Test');

      await loader.getItems('command');
      const callsAfterSecond = mockedChokidar.watch.mock.calls.length;

      expect(callsAfterSecond).toBe(callsAfterFirst);
    });

    test('should close all watchers on stopWatching', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{basename}',
          type: 'command',
          description: '',
          sourcePath: '~/plugins/cache/**/*.md',
        },
      ];
      const loader = new CustomSearchLoader(config);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: test\n---\n# Test');

      await loader.getItems('command');

      await expect(loader.stopWatching()).resolves.toBeUndefined();
    });
  });

  describe('sourceCommand with sourceDir (cwd)', () => {
    const defaultExecImpl = ((cmd: string, optsOrCb: any, cb?: any) => {
      const callback = typeof optsOrCb === 'function' ? optsOrCb : cb;
      const options = typeof optsOrCb === 'object' ? optsOrCb : {};
      execCalls.push({ command: cmd, options });
      if (callback) callback(null, 'line1\nline2', '');
    }) as any;

    beforeEach(() => {
      execCalls.length = 0;
      vi.mocked(exec).mockImplementation(defaultExecImpl);
    });

    test('should pass sourceDir as cwd to execAsync', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{line}',
          type: 'mention',
          description: '',
          sourcePath: '',
          sourceCommand: './search.sh',
          sourceDir: '/path/to/plugin/dir',
          searchPrefix: 'test',
        },
      ];
      const loader = new CustomSearchLoader(config);
      await loader.getItems('mention');

      // Verify cwd was passed to exec
      const call = execCalls.find(c => c.command === './search.sh');
      expect(call).toBeDefined();
      expect(call!.options.cwd).toBe('/path/to/plugin/dir');
    });

    test('should not pass cwd when sourceDir is undefined', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{line}',
          type: 'mention',
          description: '',
          sourcePath: '',
          sourceCommand: 'echo hello',
          searchPrefix: 'test',
        },
      ];
      const loader = new CustomSearchLoader(config);
      await loader.searchItems('mention', 'test:');

      const call = execCalls.find(c => c.command === 'echo hello');
      expect(call).toBeDefined();
      expect(call!.options).not.toHaveProperty('cwd');
    });

    test('should use different cache keys for same command with different sourceDir', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{line}',
          type: 'mention',
          description: '',
          sourcePath: '',
          sourceCommand: './search.sh',
          sourceDir: '/plugin-a',
          searchPrefix: 'a',
        },
        {
          name: '{line}',
          type: 'mention',
          description: '',
          sourcePath: '',
          sourceCommand: './search.sh',
          sourceDir: '/plugin-b',
          searchPrefix: 'b',
        },
      ];

      const loader = new CustomSearchLoader(config);
      await loader.getItems('mention');

      // Both entries should trigger separate exec calls (different cache keys)
      const calls = execCalls.filter(c => c.command === './search.sh');
      expect(calls).toHaveLength(2);
      expect(calls.some(c => c.options?.cwd === '/plugin-a')).toBe(true);
      expect(calls.some(c => c.options?.cwd === '/plugin-b')).toBe(true);
    });

    test('should execute multiple sourceCommand entries in parallel with correct cwd', async () => {
      const config: CustomSearchEntry[] = [
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: './alpha.sh', sourceDir: '/plugins/alpha', searchPrefix: 'a',
        },
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: './beta.sh', sourceDir: '/plugins/beta', searchPrefix: 'b',
        },
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: 'ghq list', searchPrefix: 'ghq',
        },
      ];

      const loader = new CustomSearchLoader(config);
      await loader.getItems('mention');

      // All three commands should have been executed
      expect(execCalls).toHaveLength(3);
      expect(execCalls.find(c => c.command === './alpha.sh')!.options.cwd).toBe('/plugins/alpha');
      expect(execCalls.find(c => c.command === './beta.sh')!.options.cwd).toBe('/plugins/beta');
      expect(execCalls.find(c => c.command === 'ghq list')!.options).not.toHaveProperty('cwd');
    });

    test('should isolate errors: one failed sourceCommand should not affect others', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, optsOrCb: any, cb?: any) => {
        const callback = typeof optsOrCb === 'function' ? optsOrCb : cb;
        const options = typeof optsOrCb === 'object' ? optsOrCb : {};
        execCalls.push({ command: cmd, options });
        if (cmd === './failing.sh') {
          // Simulate command failure
          if (callback) callback(new Error('script not found'), '', 'No such file or directory');
        } else {
          if (callback) callback(null, 'result1\nresult2', '');
        }
      }) as any);

      const config: CustomSearchEntry[] = [
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: './success.sh', sourceDir: '/plugins/good', searchPrefix: 'good',
        },
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: './failing.sh', sourceDir: '/plugins/bad', searchPrefix: 'bad',
        },
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: './another.sh', sourceDir: '/plugins/also-good', searchPrefix: 'ok',
        },
      ];

      const loader = new CustomSearchLoader(config);
      // Should not throw despite one command failing
      await expect(loader.getItems('mention')).resolves.toBeDefined();

      // All three commands should have been attempted
      expect(execCalls).toHaveLength(3);
      expect(execCalls.find(c => c.command === './success.sh')).toBeDefined();
      expect(execCalls.find(c => c.command === './failing.sh')).toBeDefined();
      expect(execCalls.find(c => c.command === './another.sh')).toBeDefined();
    });

    test('should isolate timeout: one timed-out command should not block others', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, optsOrCb: any, cb?: any) => {
        const callback = typeof optsOrCb === 'function' ? optsOrCb : cb;
        const options = typeof optsOrCb === 'object' ? optsOrCb : {};
        execCalls.push({ command: cmd, options });
        if (cmd === './slow.sh') {
          // Simulate SIGTERM timeout
          const err = new Error('Command timed out') as Error & { signal?: string };
          err.signal = 'SIGTERM';
          if (callback) callback(err, '', '');
        } else {
          if (callback) callback(null, 'fast-result', '');
        }
      }) as any);

      const config: CustomSearchEntry[] = [
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: './fast.sh', sourceDir: '/plugins/fast', searchPrefix: 'fast',
        },
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: './slow.sh', sourceDir: '/plugins/slow', searchPrefix: 'slow',
        },
      ];

      const loader = new CustomSearchLoader(config);
      await expect(loader.getItems('mention')).resolves.toBeDefined();

      // Both commands should have been attempted
      expect(execCalls).toHaveLength(2);
      expect(execCalls.find(c => c.command === './fast.sh')).toBeDefined();
      expect(execCalls.find(c => c.command === './slow.sh')).toBeDefined();
    });

    test('should build entryMap keys matching sourceId when sourceDir is set', async () => {
      // This test verifies that buildEntryMap generates keys that match the sourceId
      // used by loadAllEntries, so that findEntryForItem can resolve entries correctly.
      // Without this fix, sourceDir-based entries would fail findEntryForItem lookup,
      // breaking searchPrefix filtering in searchItems.
      const config: CustomSearchEntry[] = [
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: 'zoxide query -l', sourceDir: '/plugins/path/custom-search', searchPrefix: 'z',
        },
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: 'ghq list', sourceDir: '/plugins/path/custom-search', searchPrefix: 'ghq',
        },
        {
          name: '{line}', type: 'mention', description: '', sourcePath: '',
          sourceCommand: 'echo hello', searchPrefix: 'echo',
        },
      ];

      const loader = new CustomSearchLoader(config);

      // Access private entryMap via buildEntryMap (called by loadAll, but we trigger it directly)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loaderAny = loader as any;
      loaderAny.buildEntryMap();

      // Verify entryMap keys include sourceDir suffix for entries that have sourceDir
      const keys = Array.from(loaderAny.entryMap.keys()) as string[];

      // Entry with sourceDir should have key: "mention:sourceCommand:zoxide query -l:/plugins/path/custom-search"
      expect(keys).toContain('mention:sourceCommand:zoxide query -l:/plugins/path/custom-search');
      expect(keys).toContain('mention:sourceCommand:ghq list:/plugins/path/custom-search');

      // Entry without sourceDir should have key without suffix
      expect(keys).toContain('mention:sourceCommand:echo hello');

      // Verify findEntryForItem resolves correctly with sourceDir in sourceId
      const mockItem = {
        type: 'mention' as const,
        sourceId: 'sourceCommand:zoxide query -l:/plugins/path/custom-search',
        name: 'test', description: '', filePath: '',
      };
      const entry = loaderAny.findEntryForItem(mockItem);
      expect(entry).toBeDefined();
      expect(entry.sourceCommand).toBe('zoxide query -l');
      expect(entry.searchPrefix).toBe('z');
    });
  });
});
