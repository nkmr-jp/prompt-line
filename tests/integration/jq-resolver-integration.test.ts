/**
 * jq-resolver integration test - uses real jq-web (not mocked)
 * Tests actual jq evaluation with WebAssembly
 */
import { describe, test, expect, jest } from '@jest/globals';

// Mock only the logger, NOT jq-web
jest.mock('../../src/utils/utils', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Do NOT mock jq-web - use real implementation
jest.unmock('jq-web');

import { evaluateJq } from '../../src/lib/jq-resolver';

describe('jq-resolver integration (real jq-web)', () => {
  describe('basic expressions', () => {
    test('should evaluate simple path: .members', async () => {
      const data = {
        members: [
          { name: 'alice', role: 'lead' },
          { name: 'bob', role: 'dev' }
        ]
      };

      const result = await evaluateJq(data, '.members');

      expect(result).toEqual([
        { name: 'alice', role: 'lead' },
        { name: 'bob', role: 'dev' }
      ]);
    });

    test('should evaluate nested path: .team.members', async () => {
      const data = {
        team: {
          members: [
            { name: 'alice' },
            { name: 'bob' }
          ]
        }
      };

      const result = await evaluateJq(data, '.team.members');

      expect(result).toEqual([
        { name: 'alice' },
        { name: 'bob' }
      ]);
    });

    test('should evaluate scalar value: .name', async () => {
      const data = { name: 'test-team', count: 3 };

      const result = await evaluateJq(data, '.name');

      expect(result).toBe('test-team');
    });

    test('should return null for nonexistent path', async () => {
      const data = { foo: 'bar' };

      const result = await evaluateJq(data, '.nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('complex expressions with pipes', () => {
    test('should filter with select: .members | map(select(.active))', async () => {
      const data = {
        members: [
          { name: 'alice', active: true },
          { name: 'bob', active: false },
          { name: 'carol', active: true }
        ]
      };

      const result = await evaluateJq(data, '.members | map(select(.active))');

      expect(result).toEqual([
        { name: 'alice', active: true },
        { name: 'carol', active: true }
      ]);
    });

    test('should extract fields: .members | map(.name)', async () => {
      const data = {
        members: [
          { name: 'alice', role: 'lead' },
          { name: 'bob', role: 'dev' }
        ]
      };

      const result = await evaluateJq(data, '.members | map(.name)');

      expect(result).toEqual(['alice', 'bob']);
    });

    test('should use length: .members | length', async () => {
      const data = { members: [1, 2, 3] };

      const result = await evaluateJq(data, '.members | length');

      expect(result).toBe(3);
    });

    test('should use array index: .members[0]', async () => {
      const data = {
        members: [
          { name: 'alice' },
          { name: 'bob' }
        ]
      };

      const result = await evaluateJq(data, '.members[0]');

      expect(result).toEqual({ name: 'alice' });
    });

    test('should use keys_unsorted: .members[0] | keys_unsorted', async () => {
      const data = {
        members: [
          { name: 'alice', role: 'lead', active: true }
        ]
      };

      const result = await evaluateJq(data, '.members[0] | keys_unsorted');

      expect(result).toEqual(expect.arrayContaining(['name', 'role', 'active']));
    });
  });

  describe('real-world patterns for custom-search-loader', () => {
    test('should work with Claude team config pattern: .members', async () => {
      // Simulates ~/.claude/teams/*/config.json
      const teamConfig = {
        team_name: 'my-project',
        description: 'Working on feature X',
        members: [
          { name: 'team-lead', agentId: 'abc-123', agentType: 'general-purpose' },
          { name: 'researcher', agentId: 'def-456', agentType: 'Explore' },
          { name: 'tester', agentId: 'ghi-789', agentType: 'qa-engineer' }
        ]
      };

      const result = await evaluateJq(teamConfig, '.members');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect((result as Record<string, unknown>[])[0]).toHaveProperty('name', 'team-lead');
      expect((result as Record<string, unknown>[])[1]).toHaveProperty('name', 'researcher');
      expect((result as Record<string, unknown>[])[2]).toHaveProperty('name', 'tester');
    });

    test('should filter active members: .members | map(select(.active))', async () => {
      const teamConfig = {
        members: [
          { name: 'alice', active: true, role: 'dev' },
          { name: 'bob', active: false, role: 'tester' },
          { name: 'carol', active: true, role: 'lead' }
        ]
      };

      const result = await evaluateJq(teamConfig, '.members | map(select(.active))');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      const names = (result as Record<string, unknown>[]).map(m => m.name);
      expect(names).toEqual(['alice', 'carol']);
    });

    test('should handle empty result from filter', async () => {
      const data = {
        members: [
          { name: 'alice', active: false },
          { name: 'bob', active: false }
        ]
      };

      const result = await evaluateJq(data, '.members | map(select(.active))');

      expect(result).toEqual([]);
    });

    test('should handle JSONL line with jq: .user', async () => {
      // Simulates a single JSONL line
      const jsonlLine = {
        timestamp: 1234567890,
        user: { name: 'alice', role: 'admin' }
      };

      const result = await evaluateJq(jsonlLine, '.user');

      expect(result).toEqual({ name: 'alice', role: 'admin' });
    });
  });

  describe('error handling', () => {
    test('should return null for invalid jq syntax', async () => {
      const data = { foo: 'bar' };

      const result = await evaluateJq(data, '.[invalid');

      expect(result).toBeNull();
    });

    test('should handle empty object', async () => {
      const result = await evaluateJq({}, '.members');

      expect(result).toBeNull();
    });

    test('should handle type mismatch (string where array expected)', async () => {
      const data = { members: 'not-an-array' };

      const result = await evaluateJq(data, '.members | map(.name)');

      expect(result).toBeNull();
    });
  });
});
