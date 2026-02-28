
// Mock only the logger - use real jq-web via require()
// Note: vi.mock('jq-web') does not intercept require() in Vitest ESM mode,
// so we test with the real jq-web WASM module and verify results directly.
vi.mock('../../src/utils/utils', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { evaluateJq } from '../../src/lib/jq-resolver';

describe('jq-resolver', () => {
  describe('evaluateJq', () => {
    test('should evaluate simple jq expression', async () => {
      const data = { members: [{ name: 'alice' }, { name: 'bob' }] };

      const result = await evaluateJq(data, '.members');

      expect(result).toEqual([{ name: 'alice' }, { name: 'bob' }]);
    });

    test('should evaluate complex jq expression with pipe and filter', async () => {
      const data = {
        members: [
          { name: 'alice', active: true },
          { name: 'bob', active: false }
        ]
      };

      const result = await evaluateJq(data, '.members | map(select(.active))');

      expect(result).toEqual([{ name: 'alice', active: true }]);
    });

    test('should evaluate nested path expression', async () => {
      const data = { team: { members: [{ name: 'alice' }] } };

      const result = await evaluateJq(data, '.team.members');

      expect(result).toEqual([{ name: 'alice' }]);
    });

    test('should return null when jq expression is invalid', async () => {
      const data = { foo: 'bar' };

      const result = await evaluateJq(data, '.invalid|||');

      expect(result).toBeNull();
    });

    test('should return null when data path does not exist', async () => {
      const data = { foo: 'bar' };

      const result = await evaluateJq(data, '.nonexistent');

      expect(result).toBeNull();
    });

    test('should handle scalar results', async () => {
      const data = { count: 42 };

      const result = await evaluateJq(data, '.count');

      expect(result).toBe(42);
    });

    test('should handle string results', async () => {
      const data = { name: 'test' };

      const result = await evaluateJq(data, '.name');

      expect(result).toBe('test');
    });

    test('should handle object results', async () => {
      const data = { user: { name: 'alice', role: 'admin' } };

      const result = await evaluateJq(data, '.user');

      expect(result).toEqual({ name: 'alice', role: 'admin' });
    });

    test('should handle empty array results', async () => {
      const data = { members: [] };

      const result = await evaluateJq(data, '.members');

      expect(result).toEqual([]);
    });
  });
});
