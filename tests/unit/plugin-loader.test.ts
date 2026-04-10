import { PluginLoader } from '../../src/lib/plugin-loader';
import fs from 'fs';
import yaml from 'js-yaml';
import { logger } from '../../src/utils/utils';

// Unmock path module (needed for path.resolve, path.sep, etc.)
vi.unmock('path');

vi.mock('../../src/config/app-config', () => {
  return {
    default: {
      paths: {
        pluginsDir: '/test/.prompt-line/plugins',
        agentBuiltInDir: '/test/.prompt-line/agent-built-in',
        agentSkillsDir: '/test/.prompt-line/agent-skills',
        customSearchDir: '/test/.prompt-line/custom-search',
      }
    }
  };
});

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('js-yaml', () => ({
  default: {
    load: vi.fn(),
    JSON_SCHEMA: 'JSON_SCHEMA',
  },
  load: vi.fn(),
  JSON_SCHEMA: 'JSON_SCHEMA',
}));

vi.mock('../../src/utils/utils', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  validateColorValue: vi.fn((color: string | undefined) => color || 'grey'),
}));

const mockedFs = vi.mocked(fs);
const mockedYaml = vi.mocked(yaml);
const mockedLogger = vi.mocked(logger);

describe('PluginLoader', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new PluginLoader();
  });

  // --- Path traversal blocking ---

  describe('path traversal protection', () => {
    it('rejects plugin paths containing ".."', () => {
      const entries = loader.loadPluginEntries([
        { path: 'github.com/user/../evil/agent-skills/cmd' }
      ]);
      expect(entries).toEqual([]);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid plugin path rejected')
      );
    });

    it('rejects absolute plugin paths', () => {
      const entries = loader.loadPluginEntries([
        { path: '/etc/passwd/agent-skills/cmd' }
      ]);
      expect(entries).toEqual([]);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid plugin path rejected')
      );
    });

    it('rejects plugin paths with fewer than 3 segments', () => {
      const entries = loader.loadPluginEntries([
        { path: 'agent-skills/cmd' }
      ]);
      expect(entries).toEqual([]);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid plugin path format')
      );
    });
  });

  // --- Plugin type detection ---

  describe('plugin type detection', () => {
    it('returns null for paths without a valid plugin type', () => {
      const entries = loader.loadPluginEntries([
        { path: 'github.com/user/repo/unknown-type/name' }
      ]);
      expect(entries).toEqual([]);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown plugin type')
      );
    });

    it('returns null for paths with only one segment', () => {
      const result = loader.loadAgentBuiltIn(['single']);
      expect(result).toEqual([]);
    });
  });

  // --- agent-skills plugin loading ---

  describe('agent-skills plugin loading', () => {
    const pluginPath = 'github.com/user/repo/claude/agent-skills/commands';
    const yamlContent = 'name: test-skill\ndescription: A test skill\nsourcePath: /path/to/source';

    it('loads a valid agent-skills plugin', () => {
      mockedFs.readFileSync.mockReturnValue(yamlContent);
      mockedYaml.load.mockReturnValue({
        name: 'test-skill',
        description: 'A test skill',
        sourcePath: '/path/to/source',
      });

      const entries = loader.loadPluginEntries([{ path: pluginPath }]);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'command',
        name: 'test-skill',
        description: 'A test skill',
        sourcePath: '/path/to/source',
      });
    });

    it('returns empty for plugin YAML missing name', () => {
      mockedFs.readFileSync.mockReturnValue(yamlContent);
      mockedYaml.load.mockReturnValue({
        description: 'missing name',
        sourcePath: '/path/to/source',
      });

      const entries = loader.loadPluginEntries([{ path: pluginPath }]);
      expect(entries).toEqual([]);
    });

    it('returns empty for plugin YAML missing sourcePath and sourceCommand', () => {
      mockedFs.readFileSync.mockReturnValue(yamlContent);
      mockedYaml.load.mockReturnValue({
        name: 'test-skill',
        description: 'missing source',
      });

      const entries = loader.loadPluginEntries([{ path: pluginPath }]);
      expect(entries).toEqual([]);
    });

    it('copies optional fields from YAML', () => {
      mockedFs.readFileSync.mockReturnValue(yamlContent);
      mockedYaml.load.mockReturnValue({
        name: 'test-skill',
        description: 'A test skill',
        sourcePath: '/path/to/source',
        label: 'my-label',
        icon: 'codicon-rocket',
        searchPrefix: 'sk',
        excludeMarker: '.hidden',
      });

      const entries = loader.loadPluginEntries([{ path: pluginPath }]);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        label: 'my-label',
        icon: 'codicon-rocket',
        searchPrefix: 'sk',
        excludeMarker: '.hidden',
      });
    });

    it('applies overrides from plugin path suffixes', () => {
      mockedFs.readFileSync.mockReturnValue(yamlContent);
      mockedYaml.load.mockReturnValue({
        name: 'test-skill',
        description: 'A test skill',
        sourcePath: '/path/to/source',
        searchPrefix: 'original',
      });

      const entries = loader.loadPluginEntries([{
        path: pluginPath,
        overrides: { searchPrefix: 'overridden', args: { key: 'val' } }
      }]);

      expect(entries).toHaveLength(1);
      expect(entries[0]!.searchPrefix).toBe('overridden');
      expect(entries[0]!.args).toEqual({ key: 'val' });
    });
  });

  // --- custom-search plugin loading ---

  describe('custom-search plugin loading', () => {
    const pluginPath = 'github.com/user/repo/claude/custom-search/bookmarks';

    it('loads a custom-search plugin with type "mention"', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'bookmarks',
        description: 'Browser bookmarks',
        sourceCommand: 'cat bookmarks.json',
      });

      const entries = loader.loadPluginEntries([{ path: pluginPath }]);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'mention',
        name: 'bookmarks',
        sourceCommand: 'cat bookmarks.json',
      });
    });
  });

  // --- agent-built-in plugin loading ---

  describe('agent-built-in plugin loading', () => {
    const pluginPath = 'github.com/user/repo/claude/agent-built-in/en';

    it('loads agent-built-in commands', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'Claude',
        reference: 'https://docs.example.com',
        color: 'blue',
        commands: [
          { name: 'init', description: 'Initialize project' },
          { name: 'review', description: 'Review code', 'argument-hint': '[file]' },
        ],
      });

      const result = loader.loadAgentBuiltIn([pluginPath]);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'init',
        description: 'Initialize project',
        source: 'en',
        displayName: 'Claude',
      });
      expect(result[1]).toMatchObject({
        name: 'review',
        argumentHint: '[file]',
      });
    });

    it('loads agent-built-in skills with icon', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'Claude',
        skills: [
          { name: 'explain', description: 'Explain code' },
        ],
      });

      const result = loader.loadAgentBuiltIn([pluginPath]);

      expect(result).toHaveLength(1);
      expect(result[0]!.icon).toBe('codicon-edit-sparkle');
    });

    it('loads agent-built-in agents', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'Claude',
        agents: [
          { name: 'task-master', description: 'Task management agent' },
        ],
      });

      const result = loader.loadAgentBuiltInAgents([pluginPath]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'task-master',
        description: 'Task management agent',
        label: 'Claude',
      });
    });

    it('skips agent-built-in paths in loadPluginEntries', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'Claude',
        commands: [{ name: 'init', description: 'Init' }],
      });

      const entries = loader.loadPluginEntries([{ path: pluginPath }]);
      expect(entries).toEqual([]);
    });
  });

  // --- Cache behavior ---

  describe('cache behavior', () => {
    const pluginPath = 'github.com/user/repo/claude/agent-skills/commands';

    it('returns cached result on second load', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'test-skill',
        description: 'A test skill',
        sourcePath: '/path',
      });

      // First load
      const first = loader.loadPluginEntries([{ path: pluginPath }]);
      expect(first).toHaveLength(1);

      // Second load should hit cache (readFileSync not called again)
      const readCallCount = mockedFs.readFileSync.mock.calls.length;
      const second = loader.loadPluginEntries([{ path: pluginPath }]);
      expect(second).toHaveLength(1);
      expect(mockedFs.readFileSync.mock.calls.length).toBe(readCallCount);
    });

    it('clearCache forces reload', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'test-skill',
        description: 'A test skill',
        sourcePath: '/path',
      });

      loader.loadPluginEntries([{ path: pluginPath }]);
      const callsAfterFirst = mockedFs.readFileSync.mock.calls.length;

      loader.clearCache();
      loader.loadPluginEntries([{ path: pluginPath }]);

      expect(mockedFs.readFileSync.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });

  // --- Standalone file loaders ---

  describe('standalone file loaders', () => {
    it('rejects names with path traversal', () => {
      const result = loader.loadAgentSkillFile('../etc/passwd');
      expect(result).toBeNull();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid standalone entry name rejected')
      );
    });

    it('rejects names with slashes', () => {
      const result = loader.loadCustomSearchFile('foo/bar');
      expect(result).toBeNull();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid standalone entry name rejected')
      );
    });

    it('rejects names with backslashes', () => {
      const result = loader.loadAgentSkillFile('foo\\bar');
      expect(result).toBeNull();
    });

    it('loads a valid agent-skills standalone file', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'my-command',
        description: 'A standalone command',
        sourcePath: '/path/to/source',
      });

      const result = loader.loadAgentSkillFile('my-command');

      expect(result).toMatchObject({
        type: 'command',
        name: 'my-command',
        description: 'A standalone command',
      });
    });

    it('loads a valid custom-search standalone file', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'my-search',
        description: 'A standalone search',
        sourceCommand: 'echo hello',
      });

      const result = loader.loadCustomSearchFile('my-search');

      expect(result).toMatchObject({
        type: 'mention',
        name: 'my-search',
        sourceCommand: 'echo hello',
      });
    });

    it('caches standalone file lookups (hit and miss)', () => {
      // Miss case - file not found
      mockedFs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      const result1 = loader.loadAgentSkillFile('missing');
      expect(result1).toBeNull();

      // Second call should hit cache, not read file again
      const callsAfterFirst = mockedFs.readFileSync.mock.calls.length;
      const result2 = loader.loadAgentSkillFile('missing');
      expect(result2).toBeNull();
      expect(mockedFs.readFileSync.mock.calls.length).toBe(callsAfterFirst);
    });
  });

  // --- Search filtering ---

  describe('search filtering', () => {
    it('searchAgentBuiltIn filters by query prefix', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'Claude',
        commands: [
          { name: 'init', description: 'Initialize' },
          { name: 'install', description: 'Install' },
          { name: 'review', description: 'Review code' },
        ],
      });

      const pluginPath = 'github.com/user/repo/claude/agent-built-in/en';
      const result = loader.searchAgentBuiltIn([pluginPath], 'in');

      expect(result).toHaveLength(2);
      expect(result.map(r => r.name)).toEqual(['init', 'install']);
    });

    it('searchAgentBuiltIn returns all when query is empty', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'Claude',
        commands: [
          { name: 'init', description: 'Initialize' },
        ],
      });

      const pluginPath = 'github.com/user/repo/claude/agent-built-in/en';
      const result = loader.searchAgentBuiltIn([pluginPath], '');
      expect(result).toHaveLength(1);
    });

    it('searchLegacyAgentBuiltIn returns empty for no names', () => {
      const result = loader.searchLegacyAgentBuiltIn([], 'query');
      expect(result).toEqual([]);
    });
  });

  // --- YAML parsing edge cases ---

  describe('YAML parsing', () => {
    it('returns null when YAML parse returns non-object', () => {
      const pluginPath = 'github.com/user/repo/claude/agent-skills/commands';
      mockedFs.readFileSync.mockReturnValue('just a string');
      mockedYaml.load.mockReturnValue('a plain string');

      const entries = loader.loadPluginEntries([{ path: pluginPath }]);
      expect(entries).toEqual([]);
    });

    it('returns null when YAML parse returns null', () => {
      const pluginPath = 'github.com/user/repo/claude/agent-skills/commands';
      mockedFs.readFileSync.mockReturnValue('');
      mockedYaml.load.mockReturnValue(null);

      const entries = loader.loadPluginEntries([{ path: pluginPath }]);
      expect(entries).toEqual([]);
    });

    it('falls back to .yml when .yaml file read throws', () => {
      const pluginPath = 'github.com/user/repo/claude/agent-skills/commands';

      let callCount = 0;
      mockedFs.readFileSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('ENOENT'); // .yaml fails
        return 'yaml content'; // .yml succeeds
      });

      mockedYaml.load.mockReturnValue({
        name: 'fallback',
        description: 'Loaded from .yml',
        sourcePath: '/path',
      });

      const entries = loader.loadPluginEntries([{ path: pluginPath }]);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.name).toBe('fallback');
    });
  });

  // --- References resolution ---

  describe('references resolution', () => {
    const pluginPath = 'github.com/user/repo/claude/agent-built-in/en';

    it('uses references array when present', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'Claude',
        references: ['https://docs1.example.com', 'https://docs2.example.com'],
        reference: 'https://legacy.example.com',
        commands: [{ name: 'init', description: 'Initialize' }],
      });

      const result = loader.loadAgentBuiltIn([pluginPath]);
      expect(result[0]!.frontmatter).toContain('reference: https://docs1.example.com');
      expect(result[0]!.frontmatter).toContain('reference: https://docs2.example.com');
      expect(result[0]!.frontmatter).not.toContain('legacy');
    });

    it('falls back to legacy reference when references is absent', () => {
      mockedFs.readFileSync.mockReturnValue('yaml');
      mockedYaml.load.mockReturnValue({
        name: 'Claude',
        reference: 'https://legacy.example.com',
        commands: [{ name: 'init', description: 'Initialize' }],
      });

      const result = loader.loadAgentBuiltIn([pluginPath]);
      expect(result[0]!.frontmatter).toContain('reference: https://legacy.example.com');
    });
  });
});
