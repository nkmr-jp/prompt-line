/**
 * CustomSearchLoader + jq-web integration test
 * Tests the full pipeline: file reading → jq evaluation → item generation
 *
 * Note: jq-web requires real fs.readFileSync for WASM loading, so we mock
 * jq-resolver with a simulated jq implementation for testing the full pipeline.
 * Real jq-web integration is tested in jq-resolver-integration.test.ts.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { promises as fs } from 'fs';

// Unmock path module
jest.unmock('path');

// Mock glob module
jest.mock('glob', () => ({
  glob: jest.fn()
}));

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

// Mock os module
jest.mock('os', () => ({
  homedir: jest.fn(() => '/Users/test')
}));

/**
 * Simulate jq behavior for testing
 * Handles common jq patterns used in custom-search-loader
 */
function simulateJq(data: unknown, expression: string): unknown {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return null;

  // Simple path: .members, .team.members, .user, etc.
  const simplePathMatch = expression.match(/^\.([a-zA-Z0-9_.]+)$/);
  if (simplePathMatch) {
    const path = simplePathMatch[1]!;
    let current: unknown = data;
    for (const key of path.split('.')) {
      if (current === null || current === undefined || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[key];
    }
    return current ?? null;
  }

  // Filter pattern: .path | map(select(.field))
  const filterMatch = expression.match(/^\.([a-zA-Z0-9_.]+)\s*\|\s*map\(select\(\.([a-zA-Z0-9_]+)\)\)$/);
  if (filterMatch) {
    const [, path, field] = filterMatch;
    let current: unknown = data;
    for (const key of path!.split('.')) {
      if (current === null || current === undefined || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[key];
    }
    if (!Array.isArray(current)) return null;
    return current.filter(item => {
      if (typeof item !== 'object' || item === null) return false;
      return !!(item as Record<string, unknown>)[field!];
    });
  }

  return null;
}

const mockEvaluateJq = jest.fn<(data: unknown, expression: string) => Promise<unknown>>();
mockEvaluateJq.mockImplementation(async (data, expression) => simulateJq(data, expression));

jest.mock('../../src/lib/jq-resolver', () => ({
  evaluateJq: (...args: unknown[]) => mockEvaluateJq(...args as [unknown, string])
}));

import CustomSearchLoader from '../../src/managers/custom-search-loader';

const mockedFs = jest.mocked(fs);

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

describe('CustomSearchLoader + jq integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEvaluateJq.mockImplementation(async (data, expression) => simulateJq(data, expression));
  });

  describe('JSON file with simple jq expression', () => {
    test('should expand .members array from team config', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@agentType}',
          path: '/path/to/teams',
          pattern: '**/config.json@.members',
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
        team_name: 'my-project',
        members: [
          { name: 'team-lead', agentType: 'general-purpose' },
          { name: 'researcher', agentType: 'Explore' },
          { name: 'tester', agentType: 'qa-engineer' }
        ]
      }));

      const items = await loader.searchItems('mention', 'member:');

      expect(mockEvaluateJq).toHaveBeenCalledWith(
        expect.objectContaining({ team_name: 'my-project' }),
        '.members'
      );
      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['researcher', 'team-lead', 'tester']);
      expect(items.find(i => i.name === 'team-lead')?.description).toBe('general-purpose');
      expect(items.find(i => i.name === 'researcher')?.description).toBe('Explore');
      expect(items.find(i => i.name === 'tester')?.description).toBe('qa-engineer');
    });
  });

  describe('JSON file with complex jq expression (filter)', () => {
    test('should filter active members using select', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@role}',
          path: '/path/to/data',
          pattern: '*.json@.members | map(select(.active))',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('team.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        members: [
          { name: 'alice', role: 'lead', active: true },
          { name: 'bob', role: 'dev', active: false },
          { name: 'carol', role: 'pm', active: true }
        ]
      }));

      const items = await loader.getItems('mention');

      expect(mockEvaluateJq).toHaveBeenCalledWith(
        expect.any(Object),
        '.members | map(select(.active))'
      );
      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['alice', 'carol']);
      expect(items.find(i => i.name === 'alice')?.description).toBe('lead');
      expect(items.find(i => i.name === 'carol')?.description).toBe('pm');
    });
  });

  describe('JSON file with nested jq path', () => {
    test('should resolve .team.members path', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@role}',
          path: '/path/to/data',
          pattern: '*.json@.team.members',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('org.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        team: {
          name: 'engineering',
          members: [
            { name: 'alice', role: 'lead' },
            { name: 'bob', role: 'dev' }
          ]
        }
      }));

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(2);
      expect(items.find(i => i.name === 'alice')?.description).toBe('lead');
      expect(items.find(i => i.name === 'bob')?.description).toBe('dev');
    });
  });

  describe('JSON file with non-array jq result', () => {
    test('should return empty when jq result is a string', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          path: '/path/to/data',
          pattern: '*.json@.name',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('config.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({ name: 'test' }));

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(0);
    });

    test('should return empty when jq path does not exist', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          path: '/path/to/data',
          pattern: '*.json@.nonexistent',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('config.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({ foo: 'bar' }));

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(0);
    });
  });

  describe('JSONL file with jq expression', () => {
    test('should apply jq to each JSONL line', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@role}',
          path: '/path/to/data',
          pattern: '*.jsonl@.user',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('entries.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue([
        JSON.stringify({ id: 1, user: { name: 'alice', role: 'admin' } }),
        JSON.stringify({ id: 2, user: { name: 'bob', role: 'user' } }),
        JSON.stringify({ id: 3, user: { name: 'carol', role: 'admin' } })
      ].join('\n'));

      const items = await loader.getItems('mention');

      expect(mockEvaluateJq).toHaveBeenCalledTimes(3);
      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['alice', 'bob', 'carol']);
      expect(items.find(i => i.name === 'alice')?.description).toBe('admin');
    });

    test('should expand array results from jq on JSONL lines', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          path: '/path/to/data',
          pattern: '*.jsonl@.items',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('data.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue([
        JSON.stringify({ items: [{ name: 'a' }, { name: 'b' }] }),
        JSON.stringify({ items: [{ name: 'c' }] })
      ].join('\n'));

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['a', 'b', 'c']);
    });

    test('should skip lines where jq result is null', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          path: '/path/to/data',
          pattern: '*.jsonl@.data',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('mixed.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue([
        JSON.stringify({ data: { name: 'valid' } }),
        JSON.stringify({ other: 'no-data-field' }),
        JSON.stringify({ data: { name: 'also-valid' } })
      ].join('\n'));

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['also-valid', 'valid']);
    });
  });

  describe('JSONL file without jq expression (default behavior)', () => {
    test('should parse each line as a direct item', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@role}',
          path: '/path/to/data',
          pattern: '*.jsonl',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('entries.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue([
        JSON.stringify({ name: 'alice', role: 'lead' }),
        JSON.stringify({ name: 'bob', role: 'dev' })
      ].join('\n'));

      const items = await loader.getItems('mention');

      expect(mockEvaluateJq).not.toHaveBeenCalled();
      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort()).toEqual(['alice', 'bob']);
    });
  });

  describe('pattern without jq expression', () => {
    test('should work normally for .md files', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{basename}',
          type: 'command',
          description: '{frontmatter@description}',
          path: '/path/to/commands',
          pattern: '*.md',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('test.md', true)] as any);
      mockedFs.readFile.mockResolvedValue('---\ndescription: A test command\n---\nContent');

      const items = await loader.getItems('command');

      expect(mockEvaluateJq).not.toHaveBeenCalled();
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('test');
      expect(items[0]?.description).toBe('A test command');
    });

    test('should work normally for .json files without @', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'command',
          description: '{json@description}',
          path: '/path/to/json',
          pattern: '*.json',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('cmd.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'my-command',
        description: 'A JSON command'
      }));

      const items = await loader.getItems('command');

      expect(mockEvaluateJq).not.toHaveBeenCalled();
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('my-command');
      expect(items[0]?.description).toBe('A JSON command');
    });
  });

  describe('JSON file with parent reference {json:1@field}', () => {
    test('should resolve {json:1@field} to parent JSON data when using jq expansion', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json:1@team_name}',
          path: '/path/to/teams',
          pattern: '**/config.json@.members',
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
        team_name: 'alpha',
        members: [
          { name: 'alice', role: 'lead' },
          { name: 'bob', role: 'dev' }
        ]
      }));

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(2);
      // All items should have parent's team_name as description
      expect(items.find(i => i.name === 'alice')?.description).toBe('alpha');
      expect(items.find(i => i.name === 'bob')?.description).toBe('alpha');
    });

    test('should combine {json@path} and {json:1@path} in same template', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json@role} in {json:1@team_name}',
          path: '/path/to/teams',
          pattern: '**/config.json@.members',
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
        team_name: 'alpha',
        members: [
          { name: 'alice', role: 'lead' },
        ]
      }));

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(1);
      expect(items[0]?.description).toBe('lead in alpha');
    });
  });

  describe('JSONL file with parent reference {json:1@field}', () => {
    test('should resolve {json:1@field} to line data when jq expands array', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '{json:1@group}',
          path: '/path/to/data',
          pattern: '*.jsonl@.items',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('data.jsonl', true)] as any);
      mockedFs.readFile.mockResolvedValue([
        JSON.stringify({ group: 'team-a', items: [{ name: 'alice' }, { name: 'bob' }] }),
        JSON.stringify({ group: 'team-b', items: [{ name: 'carol' }] })
      ].join('\n'));

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(3);
      expect(items.find(i => i.name === 'alice')?.description).toBe('team-a');
      expect(items.find(i => i.name === 'bob')?.description).toBe('team-a');
      expect(items.find(i => i.name === 'carol')?.description).toBe('team-b');
    });
  });

  describe('edge cases', () => {
    test('should handle empty JSON array from jq', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          path: '/path/to/data',
          pattern: '*.json@.members | map(select(.active))',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('team.json', true)] as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        members: [
          { name: 'alice', active: false },
          { name: 'bob', active: false }
        ]
      }));

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(0);
    });

    test('should handle multiple JSON files with jq expression', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          path: '/path/to/teams',
          pattern: '**/config.json@.members',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr === '/path/to/teams') {
          return Promise.resolve([
            createDirent('team-a', false),
            createDirent('team-b', false),
          ] as any);
        }
        if (dirStr === '/path/to/teams/team-a') {
          return Promise.resolve([createDirent('config.json', true)] as any);
        }
        if (dirStr === '/path/to/teams/team-b') {
          return Promise.resolve([createDirent('config.json', true)] as any);
        }
        return Promise.resolve([] as any);
      });
      mockedFs.readFile.mockImplementation(((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('team-a')) {
          return Promise.resolve(JSON.stringify({
            members: [{ name: 'alice' }, { name: 'bob' }]
          }));
        }
        return Promise.resolve(JSON.stringify({
          members: [{ name: 'carol' }]
        }));
      }) as any);

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(3);
      expect(items.map(i => i.name).sort()).toEqual(['alice', 'bob', 'carol']);
    });

    test('should handle invalid JSON content gracefully', async () => {
      const loader = new CustomSearchLoader([
        {
          name: '{json@name}',
          type: 'mention',
          description: '',
          path: '/path/to/data',
          pattern: '*.json@.members',
        },
      ]);

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValue([createDirent('bad.json', true)] as any);
      mockedFs.readFile.mockResolvedValue('not valid json');

      const items = await loader.getItems('mention');

      expect(items).toHaveLength(0);
    });
  });
});
