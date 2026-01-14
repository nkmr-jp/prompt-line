import { describe, it, expect, beforeEach } from '@jest/globals';
import { FzfScorer, FZF_SCORES } from '../../src/lib/fzf-scorer';

describe('FzfScorer', () => {
  let scorer: FzfScorer;

  beforeEach(() => {
    scorer = new FzfScorer();
  });

  describe('score', () => {
    it('完全一致は最高スコア', () => {
      const result = scorer.score('config', 'config');
      expect(result.matched).toBe(true);
      expect(result.score).toBeGreaterThan(80);
    });

    it('大文字小文字を無視してマッチ', () => {
      const result = scorer.score('Config', 'config');
      expect(result.matched).toBe(true);
    });

    it('パターンがテキストより長い場合はマッチしない', () => {
      const result = scorer.score('ab', 'abc');
      expect(result.matched).toBe(false);
      expect(result.score).toBe(0);
    });

    it('空パターンは常にマッチ', () => {
      const result = scorer.score('anything', '');
      expect(result.matched).toBe(true);
    });

    it('単語境界マッチにボーナス', () => {
      const boundary = scorer.score('my-config', 'mc');
      const middle = scorer.score('myconfig', 'mc');
      expect(boundary.score).toBeGreaterThan(middle.score);
    });

    it('キャメルケースマッチにボーナス', () => {
      const camel = scorer.score('MyConfig', 'mc');
      const lower = scorer.score('myconfig', 'mc');
      expect(camel.score).toBeGreaterThan(lower.score);
    });

    it('連続マッチにボーナス', () => {
      const consecutive = scorer.score('abcdef', 'abc');
      const scattered = scorer.score('axbxcdef', 'abc');
      expect(consecutive.score).toBeGreaterThan(scattered.score);
    });

    it('先頭文字のボーナスは倍', () => {
      // 先頭でのマッチは他の位置より高いボーナス
      const startMatch = scorer.score('MyConfig', 'M');
      const midMatch = scorer.score('aMyConfig', 'M');
      expect(startMatch.score).toBeGreaterThan(midMatch.score);
    });

    it('ギャップにペナルティ', () => {
      const noGap = scorer.score('abc', 'abc');
      const smallGap = scorer.score('axbc', 'abc');
      const largeGap = scorer.score('axxxxbc', 'abc');
      expect(noGap.score).toBeGreaterThan(smallGap.score);
      expect(smallGap.score).toBeGreaterThan(largeGap.score);
    });

    it('マッチ位置を正しく返す', () => {
      const result = scorer.score('abcdef', 'ace');
      expect(result.matched).toBe(true);
      expect(result.positions).toEqual([0, 2, 4]);
    });

    it('連続マッチ数を正しく返す', () => {
      const result = scorer.score('abcdef', 'abc');
      expect(result.matched).toBe(true);
      // consecutiveCountは連続マッチの追加回数をカウント（最初の文字は除外）
      expect(result.consecutiveCount).toBe(2);
    });
  });

  describe('オプション', () => {
    it('caseSensitive: true で大文字小文字を区別', () => {
      const sensitive = new FzfScorer({ caseSensitive: true });
      const result = sensitive.score('Config', 'config');
      expect(result.matched).toBe(false);
    });

    it('enableCamelCase: false でキャメルケースボーナス無効', () => {
      const noCamel = new FzfScorer({ enableCamelCase: false });
      const withCamel = new FzfScorer({ enableCamelCase: true });

      const noCamelResult = noCamel.score('MyConfig', 'mc');
      const withCamelResult = withCamel.score('MyConfig', 'mc');

      // キャメルケースボーナスがある方がスコアが高い
      expect(withCamelResult.score).toBeGreaterThan(noCamelResult.score);
    });

    it('enableBoundaryBonus: false で境界ボーナス無効', () => {
      const noBoundary = new FzfScorer({ enableBoundaryBonus: false });
      const withBoundary = new FzfScorer({ enableBoundaryBonus: true });

      const noBoundaryResult = noBoundary.score('my-config', 'mc');
      const withBoundaryResult = withBoundary.score('my-config', 'mc');

      // 境界ボーナスがある方がスコアが高い
      expect(withBoundaryResult.score).toBeGreaterThan(noBoundaryResult.score);
    });
  });

  describe('エッジケース', () => {
    it('空テキストはマッチしない', () => {
      const result = scorer.score('', 'a');
      expect(result.matched).toBe(false);
    });

    it('特殊文字を含むテキスト', () => {
      const result = scorer.score('my/path/to/file.ts', 'mptf');
      expect(result.matched).toBe(true);
    });

    it('数字を含むテキスト', () => {
      const result = scorer.score('file123', 'f1');
      expect(result.matched).toBe(true);
    });

    it('日本語テキストでもマッチ可能', () => {
      const result = scorer.score('あいうえお', 'あう');
      expect(result.matched).toBe(true);
    });
  });
});

describe('FZF_SCORES', () => {
  it('定数が正しく定義されている', () => {
    expect(FZF_SCORES.CHAR_MATCH).toBe(16);
    expect(FZF_SCORES.GAP_START).toBe(-3);
    expect(FZF_SCORES.GAP_EXTENSION).toBe(-1);
    expect(FZF_SCORES.BOUNDARY).toBe(8);
    expect(FZF_SCORES.BOUNDARY_WHITE).toBe(10);
    expect(FZF_SCORES.BOUNDARY_DELIMITER).toBe(9);
    expect(FZF_SCORES.CAMEL_CASE).toBe(7);
    expect(FZF_SCORES.CONSECUTIVE).toBe(4);
    expect(FZF_SCORES.FIRST_CHAR_MULTIPLIER).toBe(2);
  });
});
