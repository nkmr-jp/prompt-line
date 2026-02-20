import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock the utils module
jest.mock('../../src/utils/utils', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock jq-web module
const mockJson = jest.fn<(data: unknown, expression: string) => unknown>();
jest.mock('jq-web', () => {
  return Promise.resolve({
    json: (data: unknown, expression: string) => mockJson(data, expression)
  });
});

import { evaluateJq } from '../../src/lib/jq-resolver';

describe('jq-resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateJq', () => {
    test('should evaluate simple jq expression', async () => {
      const data = { members: [{ name: 'alice' }, { name: 'bob' }] };
      mockJson.mockReturnValue([{ name: 'alice' }, { name: 'bob' }]);

      const result = await evaluateJq(data, '.members');

      expect(mockJson).toHaveBeenCalledWith(data, '.members');
      expect(result).toEqual([{ name: 'alice' }, { name: 'bob' }]);
    });

    test('should evaluate complex jq expression with pipe and filter', async () => {
      const data = {
        members: [
          { name: 'alice', active: true },
          { name: 'bob', active: false }
        ]
      };
      mockJson.mockReturnValue([{ name: 'alice', active: true }]);

      const result = await evaluateJq(data, '.members | map(select(.active))');

      expect(mockJson).toHaveBeenCalledWith(data, '.members | map(select(.active))');
      expect(result).toEqual([{ name: 'alice', active: true }]);
    });

    test('should evaluate nested path expression', async () => {
      const data = { team: { members: [{ name: 'alice' }] } };
      mockJson.mockReturnValue([{ name: 'alice' }]);

      const result = await evaluateJq(data, '.team.members');

      expect(mockJson).toHaveBeenCalledWith(data, '.team.members');
      expect(result).toEqual([{ name: 'alice' }]);
    });

    test('should return null when jq expression is invalid', async () => {
      const data = { foo: 'bar' };
      mockJson.mockImplementation(() => {
        throw new Error('jq: error: invalid syntax');
      });

      const result = await evaluateJq(data, '.invalid|||');

      expect(result).toBeNull();
    });

    test('should return null when data path does not exist', async () => {
      const data = { foo: 'bar' };
      mockJson.mockReturnValue(null);

      const result = await evaluateJq(data, '.nonexistent');

      expect(result).toBeNull();
    });

    test('should handle scalar results', async () => {
      const data = { count: 42 };
      mockJson.mockReturnValue(42);

      const result = await evaluateJq(data, '.count');

      expect(result).toBe(42);
    });

    test('should handle string results', async () => {
      const data = { name: 'test' };
      mockJson.mockReturnValue('test');

      const result = await evaluateJq(data, '.name');

      expect(result).toBe('test');
    });

    test('should handle object results', async () => {
      const data = { user: { name: 'alice', role: 'admin' } };
      mockJson.mockReturnValue({ name: 'alice', role: 'admin' });

      const result = await evaluateJq(data, '.user');

      expect(result).toEqual({ name: 'alice', role: 'admin' });
    });

    test('should handle empty array results', async () => {
      const data = { members: [] };
      mockJson.mockReturnValue([]);

      const result = await evaluateJq(data, '.members');

      expect(result).toEqual([]);
    });
  });
});
