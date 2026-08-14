// Stub electron / preload deps that custom-search-handler imports at module
// load time. The dedup helper itself is pure, but ESM evaluation pulls these in.
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  BrowserWindow: class {},
}));
vi.mock('child_process', () => ({ exec: vi.fn() }));
vi.mock('../../src/lib/plugin-loader', () => ({
  default: { searchAgentBuiltIn: vi.fn(), searchLegacyAgentBuiltIn: vi.fn(), searchAllLocalAgentBuiltIn: vi.fn() },
}));
vi.mock('../../src/managers/agent-skill-cache-manager', () => ({
  agentSkillCacheManager: { invalidate: vi.fn() },
}));
vi.mock('../../src/utils/utils', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../src/utils/shell-env', () => ({ getEnhancedEnv: vi.fn(() => ({})) }));

import { getAgentSkillDedupKey, isNewerByPathVersion } from '../../src/handlers/custom-search-handler';

describe('getAgentSkillDedupKey', () => {
  test('keeps same-name Claude and Codex skills distinct by trigger', () => {
    const common = {
      name: 'issue',
      description: 'Create an issue',
      filePath: '/cache/issues-site/issue/1.0.0/skills/issue/SKILL.md',
      source: 'custom',
      label: 'issues-site / issue',
    };

    expect(getAgentSkillDedupKey({ ...common, triggers: ['/'] }))
      .not.toBe(getAgentSkillDedupKey({ ...common, triggers: ['$'] }));
  });

  test('normalizes missing slash trigger and trigger order', () => {
    const common = {
      name: 'issue',
      description: 'Create an issue',
      filePath: '/cache/issues-site/issue/1.0.0/skills/issue/SKILL.md',
    };

    expect(getAgentSkillDedupKey(common))
      .toBe(getAgentSkillDedupKey({ ...common, triggers: ['/'] }));
    expect(getAgentSkillDedupKey({ ...common, triggers: ['$', '/'] }))
      .toBe(getAgentSkillDedupKey({ ...common, triggers: ['/', '$'] }));
  });
});

describe('isNewerByPathVersion', () => {
  test('returns true when candidate path has higher semver than incumbent', () => {
    const candidate = '/Users/x/.claude/plugins/cache/agent-plugins/finance/1.2.0/skills/jpx-explorer/SKILL.md';
    const incumbent = '/Users/x/.codex/plugins/cache/agent-plugins/finance/1.0.0/skills/jpx-explorer/SKILL.md';
    expect(isNewerByPathVersion(candidate, incumbent)).toBe(true);
  });

  test('returns false when candidate path has lower semver than incumbent', () => {
    const candidate = '/Users/x/.codex/plugins/cache/agent-plugins/finance/1.0.0/skills/jpx-explorer/SKILL.md';
    const incumbent = '/Users/x/.claude/plugins/cache/agent-plugins/finance/1.2.0/skills/jpx-explorer/SKILL.md';
    expect(isNewerByPathVersion(candidate, incumbent)).toBe(false);
  });

  test('returns false when versions are equal (incumbent stays)', () => {
    const candidate = '/cache/foo/1.0.0/SKILL.md';
    const incumbent = '/cache/bar/1.0.0/SKILL.md';
    expect(isNewerByPathVersion(candidate, incumbent)).toBe(false);
  });

  test('falls back to true when candidate path lacks a version (preserves previous order)', () => {
    expect(isNewerByPathVersion('/no/version/here.md', '/cache/foo/1.0.0/SKILL.md')).toBe(true);
  });

  test('falls back to true when incumbent path lacks a version', () => {
    expect(isNewerByPathVersion('/cache/foo/1.0.0/SKILL.md', '/no/version/here.md')).toBe(true);
  });

  test('handles undefined paths gracefully', () => {
    expect(isNewerByPathVersion(undefined, '/cache/foo/1.0.0/SKILL.md')).toBe(true);
    expect(isNewerByPathVersion('/cache/foo/1.0.0/SKILL.md', undefined)).toBe(true);
  });
});
