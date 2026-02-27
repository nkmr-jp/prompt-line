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

## Phase 3: v0.23 Infinite Scroll パフォーマンス退行の修正

v0.23で追加されたinfinite scroll + カスタムスクロールバーが根本原因。
loadMore時に全アイテム再フィルタリング+全DOM再構築が発生していた。

### タスク一覧

- [x] 1. filter-engine.ts: ソート済みマッチ結果キャッシュ
  - loadMore時の同一クエリ再フィルタリング+再ソートを排除（O(n) → O(1)）
- [x] 2. history-ui-manager.ts: DOM最適化3点
  - [x] `appendHistoryItems()` — loadMore用インクリメンタルDOM追加
  - [x] スクロールハンドラのRAFスロットリング（毎フレーム発火 → 1回/フレーム）
  - [x] scrollbar/thumb DOM要素のキャッシュ（毎回getElementById → 初回のみ）
  - [x] showScrollbar()の二重RAF排除
- [x] 3. renderer.ts: loadMore時にインクリメンタルappendを使用
  - handleLoadMore: 全DOM再構築 → 新規アイテムのみappend
  - handleSearchStateChange: loadMore判定フラグによる分岐
- [x] 4. テスト・typecheck通過の確認

### 最適化の詳細

| ボトルネック | Before | After | 効果 |
|---|---|---|---|
| loadMore フィルタリング | 毎回5000件再フィルタ+再ソート | キャッシュから即返却 | **O(n)→O(1)** |
| loadMore DOM | 全アイテム再構築 | 新規分のみappend | **DOM操作95%削減** |
| スクロールハンドラ | 毎フレーム無制限発火 | RAF(1回/フレーム) | **CPU使用率大幅削減** |
| getElementById | 毎スクロールイベント×2 | 初回キャッシュ | **DOM探索排除** |
| showScrollbar RAF | スクロールRAF内で二重RAF | 単一RAF | **フレーム遅延排除** |

### 品質確認

- TypeScript typecheck: PASS
- 全テスト: 41 suites, 1134 passed, 1 skipped

## Phase 4: インクリメンタルサーチ レンダリング最適化

v0.23でカスタムスクロールバーが追加され、キーストローク毎のrenderHistory()で
50アイテムの全DOM再構築（25-40ms）が発生していた。
DOM リサイクルにより createElement/replaceChildren のコストを排除。

### タスク一覧

- [x] 1. formatTime() に now パラメータ追加（Date.now()の50回呼び出し排除）
- [x] 2. renderHistory() DOM リサイクル実装
  - [x] updateHistoryElement() — 既存DOM要素のin-place更新（createElement排除）
  - [x] updateCountIndicator() — カウント表示のin-place更新
  - [x] children直接アクセス（querySelector排除）
  - [x] 初回レンダリングとリサイクルパスの分岐
- [x] 3. scrollbar更新の条件付き実行（アイテム数変化時のみ）
- [x] 4. テスト・typecheck通過の確認

### 最適化の詳細

| ボトルネック | Before | After | 効果 |
|---|---|---|---|
| DOM要素生成 | createElement × 150 (50items × 3divs) | 0 (リサイクル) | **createElement排除** |
| replaceChildren | 毎キーストローク | 初回のみ | **DOM全置換排除** |
| Date.now() | 50回/レンダ | 1回/レンダ | **98%削減** |
| querySelector | 0 (children直接参照) | 0 | **DOM探索不要** |
| scrollbar更新 | 毎レンダ | アイテム数変化時のみ | **不要な更新排除** |

### 品質確認

- TypeScript typecheck: PASS
- 全テスト: 41 suites, 1134 passed, 1 skipped

## 変更ファイル

### Phase 1（フィルタエンジン最適化）
- `src/renderer/history-search/filter-engine.ts` - コア最適化実装
- `src/renderer/history-search/history-search-manager.ts` - キャッシュ連携

### Phase 2（E2Eレンダリング最適化）
- `src/renderer/history-search/types.ts` - デバウンス遅延 150ms → 30ms
- `src/renderer/history-search/highlighter.ts` - RegExp キャッシュ追加
- `src/renderer/history-ui-manager.ts` - replaceChildren、イベント委譲、検索状態ホイスト
- `src/renderer/history-search/history-search-manager.ts` - loadMore 重複排除

### Phase 3（v0.23 Infinite Scroll退行修正）
- `src/renderer/history-search/filter-engine.ts` - ソート済みマッチ結果キャッシュ
- `src/renderer/history-ui-manager.ts` - appendHistoryItems、RAFスロットル、DOM要素キャッシュ
- `src/renderer/renderer.ts` - loadMore時のインクリメンタルappend

### Phase 4（インクリメンタルサーチ レンダリング最適化）
- `src/renderer/utils/time-formatter.ts` - formatTime() に now パラメータ追加
- `src/renderer/history-ui-manager.ts` - DOMリサイクル、updateHistoryElement、updateCountIndicator

## Phase 5: テキスト入力時の引っかかり修正

v0.23で追加されたagentSkill/mention機能により、textareaへのキーストローク毎に
3つの独立inputイベントリスナが累積2.7-6.9msのオーバーヘッドを発生させていた。

### タスク一覧

- [x] 1. clearHistorySelection() ガード追加
  - historyIndex === -1 の時にDOM操作をスキップ（querySelectorAll排除）
- [x] 2. AgentSkillManager: sortedSkills のプリソート
  - checkForArgumentHintAtCursor()内の毎回ソートを排除
- [x] 3. checkForAgentSkill()/checkForArgumentHintAtCursor() の早期リターン最適化
  - `/` が含まれない場合にextractTriggerQueryAtCursor/スキルループ呼び出しを排除
- [x] 4. テスト・typecheck通過の確認

### 最適化の詳細

| ボトルネック | Before | After | 効果 |
|---|---|---|---|
| clearHistorySelection() | 毎キーストローク querySelectorAll+forEach | historyIndex===-1 で早期リターン | **DOM操作99%削減** |
| checkForArgumentHintAtCursor sort | 毎回 [...skills].sort() | loadSkills時1回のみ | **配列コピー+ソート排除** |
| checkForAgentSkill() | 毎回 extractTriggerQueryAtCursor | '/'無しで早期リターン | **通常入力時の処理排除** |
| checkForArgumentHintAtCursor() | 毎回 skills ループ | '/'無しで早期リターン | **通常入力時の処理排除** |

### 品質確認

- TypeScript typecheck: PASS
- 全テスト: 41 suites, 1134 passed, 1 skipped

### 変更ファイル

- `src/renderer/history-ui-manager.ts` - clearHistorySelection() 早期リターンガード
- `src/renderer/agent-skill-manager.ts` - sortedSkillsByNameLength プリソート、'/'早期リターン
