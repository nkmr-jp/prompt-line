# History検索パフォーマンス改善

## タスク一覧

- [x] 1. ベースラインベンチマーク計測（既存テストを実行して現状把握）
- [x] 2. filter-engine.ts の最適化実装
  - [x] 2a. normalizedText のプリコンピュート（toLowerCase()の繰り返し排除）
  - [x] 2b. シングルパス・スコアリング（map→filter→sort チェーンの排除）
  - [x] 2c. インラインスコアリング（関数呼び出しオーバーヘッドの排除）
  - [x] 2d. インラインタイブレーク（compareTiebreak排除）
  - [x] 2e. キーワード分割の1回化、Date.now()の1回化
- [x] 3. ベンチマークで改善効果を確認
- [x] 4. 全テスト通過の確認（41スイート, 1128テスト PASS）
- [x] 5. レビュー・まとめ

## パフォーマンス改善結果

### filter() 5000件 ベンチマーク比較

| Operation | Before (ms) | After (ms) | 改善率 |
|---|---|---|---|
| filter() 1-char "g" | 1.040 | 0.290 | **72% 高速化** |
| filter() 5-char "const" | 0.789 | 0.185 | **77% 高速化** |
| filter() 10-char "git commit" | 1.205 | 0.134 | **89% 高速化** |
| filter() no-match | 0.596 | 0.101 | **83% 高速化** |

### スケーラビリティ（per-item）

| Items | Before (μs/item) | After (μs/item) | 改善率 |
|---|---|---|---|
| 100 | 0.130 | 0.042 | **68% 高速化** |
| 1000 | 0.123 | 0.030 | **76% 高速化** |
| 5000 | 0.134 | 0.027 | **80% 高速化** |

### 品質確認

- TypeScript typecheck: PASS
- ESLint: 0 errors
- 全テスト: 41 suites, 1128 passed, 1 skipped

## Phase 2: E2Eレンダリングパイプライン最適化

フィルタエンジンは高速化済み（<0.3ms）だが体感速度が改善されなかったため、
レンダリングパイプライン全体のボトルネックを特定・修正。

### タスク一覧

- [x] 1. highlighter.ts の RegExp キャッシュ最適化
- [x] 2. history-ui-manager.ts の DOM 更新最適化
  - [x] `innerHTML=''` → `replaceChildren()` (二重リフロー排除)
  - [x] 検索状態のホイスト（per-item `getSearchManager()` 排除）
  - [x] イベント委譲（per-item クリックハンドラ排除）
- [x] 3. loadMore() の重複フィルタリング排除
- [x] 4. デバウンス遅延削減 (150ms → 30ms)

### 最適化の詳細

| ボトルネック | Before | After | 効果 |
|---|---|---|---|
| デバウンス遅延 | 150ms | 30ms | **入力→表示の遅延を120ms削減** |
| RegExp 生成 | 50個/レンダ | 1回/検索語 | **50x RegExp 生成削減** |
| DOM リフロー | 2回 (innerHTML=''+appendChild) | 1回 (replaceChildren) | **リフロー50%削減** |
| getSearchManager() | 50回/レンダ | 1回/レンダ | **関数呼び出し98%削減** |
| クリックハンドラ | 50個/レンダ | 1個（委譲） | **イベントリスナ98%削減** |
| filterWithLimit() in loadMore | 2回 | 1回 | **フィルタ処理50%削減** |

### 品質確認

- TypeScript typecheck: PASS
- 全テスト: 41 suites, 1128 passed, 1 skipped

## 変更ファイル

### Phase 1（フィルタエンジン最適化）
- `src/renderer/history-search/filter-engine.ts` - コア最適化実装
- `src/renderer/history-search/history-search-manager.ts` - キャッシュ連携

### Phase 2（E2Eレンダリング最適化）
- `src/renderer/history-search/types.ts` - デバウンス遅延 150ms → 30ms
- `src/renderer/history-search/highlighter.ts` - RegExp キャッシュ追加
- `src/renderer/history-ui-manager.ts` - replaceChildren、イベント委譲、検索状態ホイスト
- `src/renderer/history-search/history-search-manager.ts` - loadMore 重複排除
