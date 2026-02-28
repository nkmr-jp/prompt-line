import { compareTiebreak, type TiebreakOptions, type TiebreakGetters } from '../../src/lib/tiebreaker';

describe('compareTiebreak', () => {
  interface TestItem {
    name: string;
    path: string;
    index: number;
  }

  const itemA: TestItem = { name: 'abc', path: 'src/a', index: 0 };
  const itemB: TestItem = { name: 'abcdef', path: 'src/b/c', index: 1 };
  const itemC: TestItem = { name: 'abc', path: 'src/d/e/f', index: 2 };

  describe('length 基準', () => {
    const options: TiebreakOptions = { criteria: ['length'] };
    const getters: TiebreakGetters<TestItem> = {
      length: (item) => item.name.length,
    };

    it('短い方を優先（負の値を返す）', () => {
      const result = compareTiebreak(itemA, itemB, options, getters);
      expect(result).toBeLessThan(0); // itemA (3文字) < itemB (6文字)
    });

    it('同じ長さなら0を返す', () => {
      const result = compareTiebreak(itemA, itemC, options, getters);
      expect(result).toBe(0); // 両方3文字
    });
  });

  describe('index 基準', () => {
    const options: TiebreakOptions = { criteria: ['index'] };
    const getters: TiebreakGetters<TestItem> = {
      index: (item) => item.index,
    };

    it('インデックスが小さい方を優先', () => {
      const result = compareTiebreak(itemA, itemB, options, getters);
      expect(result).toBeLessThan(0); // itemA (0) < itemB (1)
    });

    it('同じインデックスなら0を返す', () => {
      const sameIndex = { ...itemB, index: 0 };
      const result = compareTiebreak(itemA, sameIndex, options, getters);
      expect(result).toBe(0);
    });
  });

  describe('pathname 基準', () => {
    const options: TiebreakOptions = { criteria: ['pathname'] };
    const getters: TiebreakGetters<TestItem> = {
      pathname: (item) => item.path,
    };

    it('パス深度が浅い方を優先', () => {
      const result = compareTiebreak(itemA, itemB, options, getters);
      expect(result).toBeLessThan(0); // itemA (2セグメント) < itemB (3セグメント)
    });

    it('同じ深さなら0を返す', () => {
      const samePath = { ...itemB, path: 'x/y' };
      const result = compareTiebreak(itemA, samePath, options, getters);
      expect(result).toBe(0);
    });
  });

  describe('複数基準', () => {
    it('最初の基準で決まればそれを返す', () => {
      const options: TiebreakOptions = { criteria: ['length', 'index'] };
      const getters: TiebreakGetters<TestItem> = {
        length: (item) => item.name.length,
        index: (item) => item.index,
      };

      const result = compareTiebreak(itemA, itemB, options, getters);
      expect(result).toBeLessThan(0); // lengthで決まる
    });

    it('最初の基準が同じなら次の基準を使う', () => {
      const options: TiebreakOptions = { criteria: ['length', 'pathname'] };
      const getters: TiebreakGetters<TestItem> = {
        length: (item) => item.name.length,
        pathname: (item) => item.path,
      };

      // itemAとitemCは同じ長さ (3) なのでpathnameで比較
      const result = compareTiebreak(itemA, itemC, options, getters);
      expect(result).toBeLessThan(0); // itemA (2セグメント) < itemC (4セグメント)
    });

    it('すべての基準が同じなら0を返す', () => {
      const options: TiebreakOptions = { criteria: ['length', 'index'] };
      const getters: TiebreakGetters<TestItem> = {
        length: (item) => item.name.length,
        index: (item) => item.index,
      };

      const sameItem = { ...itemA };
      const result = compareTiebreak(itemA, sameItem, options, getters);
      expect(result).toBe(0);
    });
  });

  describe('エッジケース', () => {
    it('空の基準配列は0を返す', () => {
      const options: TiebreakOptions = { criteria: [] };
      const result = compareTiebreak(itemA, itemB, options, {});
      expect(result).toBe(0);
    });

    it('getterが未定義の場合はデフォルト値(0)を使用', () => {
      const options: TiebreakOptions = { criteria: ['length'] };
      const result = compareTiebreak(itemA, itemB, options, {});
      expect(result).toBe(0); // 両方ともデフォルト値0
    });

    it('nullやundefinedのアイテムでもクラッシュしない', () => {
      const options: TiebreakOptions = { criteria: ['length'] };
      const getters: TiebreakGetters<TestItem | null> = {
        length: (item) => item?.name.length ?? 0,
      };

      expect(() => compareTiebreak(null, itemA, options, getters)).not.toThrow();
    });
  });
});
