vi.mock('path', async () => {
  const real = await vi.importActual<typeof import('path')>('path');
  return { ...real, default: real };
});

vi.mock('../../src/utils/utils', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  validateColorValue: vi.fn((v: string) => v)
}));

vi.mock('../../src/config/app-config', () => ({
  default: {
    paths: {
      pluginsDir: '/tmp/test-plugins',
      agentSkillsDir: '/tmp/test-agent-skills',
      customSearchDir: '/tmp/test-custom-search',
      agentBuiltInDir: '/tmp/test-agent-built-in'
    }
  }
}));

import fs from 'fs';
import { PluginLoader } from '../../src/lib/plugin-loader';
import { logger } from '../../src/utils/utils';

const SKILLS_PATH = 'github.com/user/repo/agent-skills';
const BUILT_IN_PATH = 'github.com/user/repo/agent-built-in';

function makeYaml(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([k, v]) => typeof v === 'string' ? `${k}: "${v}"` : `${k}: ${v}`)
    .join('\n');
}

function makePluginYaml(overrides: Record<string, unknown> = {}): string {
  return makeYaml({ name: 'test-entry', description: 'Test entry', sourcePath: '~/.test/*.md', ...overrides });
}

describe('PluginLoader', () => {
  let loader: InstanceType<typeof PluginLoader>;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new PluginLoader();
  });

  describe('path traversal prevention', () => {
    test('should reject paths containing ..', () => {
      const entries = loader.loadPluginEntries([{ path: 'github.com/../../agent-skills/test' }]);
      expect(entries).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid plugin path rejected'));
    });

    test('should reject absolute paths', () => {
      const entries = loader.loadPluginEntries([{ path: '/etc/passwd/agent-skills/test' }]);
      expect(entries).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid plugin path rejected'));
    });

    test('should reject paths with fewer than 3 segments', () => {
      const entries = loader.loadPluginEntries([{ path: 'agent-skills/test' }]);
      expect(entries).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid plugin path format'));
    });
  });

  describe('plugin type detection', () => {
    test('should skip agent-built-in plugins in loadPluginEntries', () => {
      const entries = loader.loadPluginEntries([{ path: `${BUILT_IN_PATH}/claude` }]);
      expect(entries).toHaveLength(0);
    });

    test('should return empty for unknown plugin type', () => {
      const entries = loader.loadPluginEntries([{ path: 'github.com/user/repo/unknown-type/test' }]);
      expect(entries).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown plugin type'));
    });
  });

  describe('loadPluginEntries', () => {
    test('should load agent-skills plugin entry from YAML', () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue(makePluginYaml({ name: 'test-command', searchPrefix: 'test', color: 'blue' }));

      const entries = loader.loadPluginEntries([{ path: `${SKILLS_PATH}/test` }]);

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('test-command');
      expect(entries[0].type).toBe('command');
      expect(entries[0].searchPrefix).toBe('test');
      expect(entries[0].color).toBe('blue');
    });

    test('should load custom-search plugin entry from YAML', () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue(makePluginYaml({ name: '{basename}', sourcePath: '~/.data/*.json', searchPrefix: 'data', maxSuggestions: 50 }));

      const entries = loader.loadPluginEntries([{ path: 'github.com/user/repo/custom-search/data' }]);

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('{basename}');
      expect(entries[0].type).toBe('mention');
      expect(entries[0].maxSuggestions).toBe(50);
    });

    test('should return empty for missing YAML file', () => {
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('ENOENT'); });
      const entries = loader.loadPluginEntries([{ path: `${SKILLS_PATH}/missing` }]);
      expect(entries).toHaveLength(0);
    });

    test('should reject entry without name', () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue('description: "No name"\nsourcePath: "~/.test/*.md"');
      const entries = loader.loadPluginEntries([{ path: `${SKILLS_PATH}/test` }]);
      expect(entries).toHaveLength(0);
    });

    test('should reject entry without sourcePath or sourceCommand', () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue('name: "incomplete"\ndescription: "Missing source"');
      const entries = loader.loadPluginEntries([{ path: `${SKILLS_PATH}/test` }]);
      expect(entries).toHaveLength(0);
    });
  });

  describe('cache behavior', () => {
    test('should cache loaded plugins', () => {
      const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(makePluginYaml());
      const pluginPath = { path: `${SKILLS_PATH}/cached` };

      loader.loadPluginEntries([pluginPath]);
      loader.loadPluginEntries([pluginPath]);

      expect(readSpy).toHaveBeenCalledTimes(1);
    });

    test('should reload after clearCache', () => {
      const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(makePluginYaml());
      const pluginPath = { path: `${SKILLS_PATH}/reload` };

      loader.loadPluginEntries([pluginPath]);
      loader.clearCache();
      loader.loadPluginEntries([pluginPath]);

      expect(readSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadAgentBuiltIn', () => {
    test('should parse commands from agent-built-in YAML', () => {
      const yamlContent = `
name: test-tool
color: amber
reference: https://example.com
commands:
  - name: help
    description: Show help
  - name: clear
    description: Clear screen
`;
      vi.spyOn(fs, 'readFileSync').mockReturnValue(yamlContent);

      const items = loader.loadAgentBuiltIn([`${BUILT_IN_PATH}/test-tool`]);

      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('help');
      expect(items[0].description).toBe('Show help');
      expect(items[1].name).toBe('clear');
    });

    test('should parse skills with icon', () => {
      const yamlContent = `
name: test-tool
skills:
  - name: review
    description: Review code
`;
      vi.spyOn(fs, 'readFileSync').mockReturnValue(yamlContent);

      const items = loader.loadAgentBuiltIn([`${BUILT_IN_PATH}/test-tool`]);

      expect(items).toHaveLength(1);
      expect(items[0].icon).toBe('codicon-edit-sparkle');
    });

    test('should skip commands without name or description', () => {
      const yamlContent = `
name: test-tool
commands:
  - name: valid
    description: A valid command
  - name: ""
    description: Missing name
  - description: Missing name field
`;
      vi.spyOn(fs, 'readFileSync').mockReturnValue(yamlContent);

      const items = loader.loadAgentBuiltIn([`${BUILT_IN_PATH}/test-tool`]);

      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('valid');
    });
  });

  describe('YAML extension fallback', () => {
    test('should fall back to .yml when .yaml is not found', () => {
      vi.spyOn(fs, 'readFileSync').mockImplementation((filePath: any) => {
        if (typeof filePath === 'string' && filePath.endsWith('.yaml')) {
          throw new Error('ENOENT');
        }
        return makePluginYaml({ name: 'yml-entry' });
      });

      const entries = loader.loadPluginEntries([{ path: `${SKILLS_PATH}/fallback` }]);

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('yml-entry');
    });
  });

  describe('overrides', () => {
    test('should apply searchPrefix override', () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue(makePluginYaml({ searchPrefix: 'original' }));

      const entries = loader.loadPluginEntries([
        { path: `${SKILLS_PATH}/test`, overrides: { searchPrefix: 'custom' } }
      ]);

      expect(entries).toHaveLength(1);
      expect(entries[0].searchPrefix).toBe('custom');
    });

    test('should merge args override', () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue(makePluginYaml() + '\nargs:\n  key1: value1');

      const entries = loader.loadPluginEntries([
        { path: `${SKILLS_PATH}/test`, overrides: { args: { key2: 'value2' } } }
      ]);

      expect(entries).toHaveLength(1);
      expect(entries[0].args).toEqual({ key1: 'value1', key2: 'value2' });
    });
  });
});
