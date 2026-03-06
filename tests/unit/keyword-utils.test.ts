import { splitKeywords } from '../../src/lib/keyword-utils';

describe('splitKeywords', () => {
  describe('full-width space (U+3000) support', () => {
    test('splits on full-width space', () => {
      expect(splitKeywords('テスト\u3000検索')).toEqual(['テスト', '検索']);
    });

    test('splits on mixed ASCII and full-width spaces', () => {
      expect(splitKeywords('テスト 検索\u3000実行')).toEqual(['テスト', '検索', '実行']);
    });

    test('returns empty array for full-width space only', () => {
      expect(splitKeywords('\u3000')).toEqual([]);
    });
  });

  describe('Japanese text without spaces', () => {
    test('returns single keyword for Japanese text with no spaces', () => {
      expect(splitKeywords('テスト')).toEqual(['テスト']);
    });
  });

  describe('existing ASCII behavior', () => {
    test('splits on ASCII space', () => {
      expect(splitKeywords('hello world')).toEqual(['hello', 'world']);
    });

    test('returns empty array for empty string', () => {
      expect(splitKeywords('')).toEqual([]);
    });

    test('trims leading and trailing spaces', () => {
      expect(splitKeywords('  hello world  ')).toEqual(['hello', 'world']);
    });

    test('collapses multiple spaces', () => {
      expect(splitKeywords('hello   world')).toEqual(['hello', 'world']);
    });
  });
});
