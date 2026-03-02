# v0.25 後の @ / サジェスト速度低下 - 調査レポート

## 概要

v0.25.0 で追加された AND 検索（スペース区切り複数キーワード検索）に伴う変更が、`@` メンションと `/` スラッシュコマンドのサジェスト表示速度を低下させている。主な原因は以下の3カテゴリに分類される:

1. **検索トリガー範囲の拡大** - `allowSpaces: true` により検索が停止せずに走り続ける
2. **計算量の増加** - AND 検索によるループ・スコア計算の複雑化
3. **既存の非効率が顕在化** - IPC 直列呼び出し、キャッシュ未活用など

---

## 特定されたボトルネック一覧（優先度順）

### P0: 最重要（v0.25 直接起因）

#### 1. `allowSpaces: true` によるサジェスト計算頻度の増加
- **影響**: `@` と `/` の両方
- **ファイル**:
  - `src/renderer/mentions/managers/query-extraction-manager.ts:50`
  - `src/renderer/agent-skill-manager.ts:278`
- **コミット**: `b981a5c`, `0685221`
- **問題**: v0.24 ではスペース入力時にクエリが終了し検索が停止していたが、v0.25 ではスペース入力後もクエリが継続するため、毎キーストロークで全パイプライン（フィルタリング + スコアリング + ソート + DOM更新 + IPC呼び出し）が再実行される
- **体感影響**: 高（検索パイプライン全体の実行頻度が増加）

#### 2. `mergeSuggestions` での `splitKeywords` / `calculateMatchScore` 再実行
- **影響**: `@` メンション
- **ファイル**:
  - `src/renderer/mentions/managers/file-filter-manager.ts:464`
  - `src/renderer/mentions/fuzzy-matcher.ts:108`
- **コミット**: `b981a5c` で問題追加、`ffc6784` で部分修正
- **問題**: `searchAllFiles` で既にスコアリング済みのファイルに対し、`mergeSuggestions` で再度 `calculateMatchScore` を呼び出す。`preSplitKeywords` が渡されていないため、ファイルごとに `splitKeywords()` が重複実行される
- **未修正箇所**: `file-filter-manager.ts:177`, `:355`, `:464` の3箇所
- **体感影響**: 高（ファイル数 × キーワード数の二重ループ）

#### 3. `calculateMatchScore` の計算量 O(1) → O(m) 化
- **影響**: `@` メンション
- **ファイル**: `src/renderer/mentions/fuzzy-matcher.ts:102-140`
- **コミット**: `b981a5c`
- **問題**: スコア計算が単一クエリの if-else チェーン（O(1)）からキーワード数のループ（O(m)）に変更。1キーワードなら変化なしだが、スペース入力時に m が増加する
- **体感影響**: 中（#1 と #2 の相乗効果で影響増大）

### P1: 重要（既存問題が v0.25 で顕在化）

#### 4. `@` メンション: 直列 IPC 呼び出し（4回）
- **影響**: `@` メンション
- **ファイル**: `src/renderer/mentions/managers/suggestion-ui-manager.ts:260-300`
- **問題**: `showSuggestions()` 内で4つの IPC 呼び出しが直列実行:
  1. `matchesSearchPrefix()` (L260)
  2. `searchAgents()` (L277)
  3. `getFileUsageBonuses()` (L287)
  4. `getMaxSuggestions()` (L300)

  IPC 2 と IPC 3 は独立しており並列化可能
- **体感影響**: 高（IPC のラウンドトリップ × 4回が毎キーストロークで発生）

#### 5. `/` コマンド: `getUsageBonuses` IPC をデバウンスなしで毎キー入力呼び出し
- **影響**: `/` スラッシュコマンド
- **ファイル**: `src/renderer/agent-skill-manager.ts:479-481`
- **問題**: `input` イベント → `showSuggestions()` → IPC `getUsageBonuses` の流れにデバウンスなし
- **体感影響**: 高（IPC のオーバーヘッドが毎キーストロークで発生）

#### 6. `/` コマンド: ダブルフィルタリング（AND フォールバック）
- **影響**: `/` スラッシュコマンド
- **ファイル**: `src/renderer/agent-skill-manager.ts:456-468`
- **コミット**: `0685221`
- **問題**: AND 検索が0件の場合、最初のキーワードのみで全スキルに対して2回目のフィルタリングを実行
- **体感影響**: 中（マッチしないクエリで顕著）

#### 7. `/` コマンド: `getSearchableFields` の非メモ化
- **影響**: `/` スラッシュコマンド
- **ファイル**: `src/renderer/agent-skill-manager.ts:430-437`
- **問題**: 毎検索・毎アイテムで文字列結合を実行。ソートでも再呼び出し
- **体感影響**: 中

#### 8. `/` コマンド: ソートコンパレータ内でスコア再計算
- **影響**: `/` スラッシュコマンド
- **ファイル**: `src/renderer/agent-skill-manager.ts:488-506`
- **問題**: `.sort()` 内で `getMatchScore()` が O(n log n) 回呼ばれる
- **体感影響**: 中

### P2: 改善推奨（既存問題）

#### 9. `getTopLevelFiles` の O(n²) 問題
- **ファイル**: `src/renderer/mentions/managers/file-filter-manager.ts:244-248`
- **問題**: `allFiles.find()` がファイルごとに呼ばれる O(n²) パターン

#### 10. DOM 全走査（`querySelectorAll`）
- **ファイル**: `src/renderer/mentions/managers/suggestion-ui-manager.ts:747`, `:175-176`
- **問題**: キーボード移動・マウス移動のたびに全 DOM 要素を走査

#### 11. `buildKeywordRegex` の毎回 RegExp コンパイル
- **ファイル**: `src/renderer/utils/highlight-utils.ts:15-19`
- **問題**: サジェスト項目ごとに正規表現をコンパイル

---

## 改善提案

### Quick Win（即効性が高い）

- [ ] **#1 の緩和**: `showSuggestions` にデバウンス（50-100ms）を追加して、連続キーストロークでの再計算を抑制
- [ ] **#2 の修正**: `mergeSuggestions` に `preSplitKeywords` を引数として追加し、`calculateMatchScore` に渡す（3箇所）
- [ ] **#4 の修正**: `Promise.all()` で IPC 2 と IPC 3 を並列実行
- [ ] **#5 の修正**: `showSuggestions` にデバウンス追加、または `usageBonuses` を TTL キャッシュ
- [ ] **#8 の修正**: ソート前にスコアを Map に事前計算

### 中期改善

- [ ] **#7 の修正**: `loadSkills()` 時に `searchableFields` を事前計算してキャッシュ
- [ ] **#6 の改善**: AND/フォールバックを1パスで実行（フォールバック候補をAND検索と同時に収集）
- [ ] **#9 の修正**: ディレクトリの `Map<string, FileInfo>` を事前構築
- [ ] **#10 の修正**: selected/hovered 要素への参照を保持し差分更新
- [ ] **#11 の修正**: `renderSuggestionsInternal` 先頭で1回だけ正規表現を構築して再利用

---

## 根本原因の結論

v0.25 の速度低下は **単一の原因ではなく、以下の複合要因** によるもの:

1. **`allowSpaces: true`** が検索パイプラインの実行頻度を大幅に増加させた（以前はスペースで停止していた検索が継続するようになった）
2. **AND 検索のスコア計算** が O(1) → O(m) に増加し、ファイルごとの処理コストが上昇
3. **`preSplitKeywords` の適用漏れ** により、最適化が部分的にしか効いていない
4. **既存の IPC 直列呼び出し** が、#1 の頻度増加により体感速度への影響が増大

特に #1（`allowSpaces: true`）は **乗数効果** があり、他のすべてのボトルネックの影響を増幅させている。
