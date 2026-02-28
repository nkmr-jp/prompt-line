
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
  });
});
