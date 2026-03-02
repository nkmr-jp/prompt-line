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

- [x] **#2 の修正**: `mergeSuggestions` に `preSplitKeywords` を引数として追加し、`calculateMatchScore` に渡す（3箇所）
- [x] **#4 の修正**: `Promise.all()` で IPC 2 と IPC 3 を並列実行
- [x] **#5 の修正**: `usageBonuses` を TTL 5秒キャッシュ
- [x] **#8 の修正**: ソート前にスコアを Map に事前計算
- [ ] **#1 の緩和**: `showSuggestions` にデバウンス（50-100ms）を追加して、連続キーストロークでの再計算を抑制

### 中期改善

- [x] **#7 の修正**: `loadSkills()` 時に `searchableFields` を事前計算してキャッシュ
- [x] **#6 の改善**: AND/フォールバックを1パスで実行（フォールバック候補をAND検索と同時に収集）
- [x] **#9 の修正**: ディレクトリの `Map<string, FileInfo>` を事前構築
- [x] **#10 の修正**: selected/hovered 要素への参照を保持し差分更新
- [x] **#11 の修正**: `renderSuggestionsInternal` 先頭で1回だけ正規表現を構築して再利用

---

## 根本原因の結論

v0.25 の速度低下は **単一の原因ではなく、以下の複合要因** によるもの:

1. **`allowSpaces: true`** が検索パイプラインの実行頻度を大幅に増加させた（以前はスペースで停止していた検索が継続するようになった）
2. **AND 検索のスコア計算** が O(1) → O(m) に増加し、ファイルごとの処理コストが上昇
3. **`preSplitKeywords` の適用漏れ** により、最適化が部分的にしか効いていない
4. **既存の IPC 直列呼び出し** が、#1 の頻度増加により体感速度への影響が増大

特に #1（`allowSpaces: true`）は **乗数効果** があり、他のすべてのボトルネックの影響を増幅させている。

---

## 第2次調査結果（2026-03-03）

前回の9項目修正後も体感速度が改善されなかった。詳細調査の結果、**パイプライン内部の最適化ではなく、パイプライン自体の不要な再実行が真の原因**であることが判明。

### 新たに特定されたクリティカル問題

#### C1. `loadAll()` の Cache Stampede（最大の原因）
- **ファイル**: `src/managers/custom-search-loader.ts:287-301`
- **問題**: キャッシュ期限切れ(5秒TTL)時に複数の同時IPC呼び出しが各々独立にフルファイルシステムスキャン(1,097ファイル)を実行。loading promise guard がないため、2-8個の並行ロードが走る
- **実測**: 90秒間で26回のフルロード、約28,522回のファイルアクセス、ピーク330行/秒のログ出力

#### C2. `showSuggestions` にデバウンスなし
- **ファイル**: `src/renderer/mentions/managers/suggestion-ui-manager.ts`
- **問題**: rAF (~16ms) では不十分。毎キーストロークで4-6 IPC呼び出し含む重いパイプラインが走る
- **補足**: HistorySearch には 150ms デバウンスがあるが、mention にはない

#### C3. キーワード変化チェックなし
- **ファイル**: `src/renderer/mentions/mention-manager.ts` の `checkForFileSearch()`
- **問題**: `@config` → `@config ` で splitKeywords 結果は同一 `["config"]` だがフル再計算が走る
- **影響**: v0.25 の `allowSpaces: true` により、スペース入力だけでも不要なパイプライン再実行が発生

#### C4. `AgentSkillCacheManager.calculateBonus()` が毎回ディスク読み取り
- **ファイル**: `src/managers/agent-skill-cache-manager.ts`
- **問題**: `calculateBonus()` が毎回 `loadGlobalEntries()` でJSONLファイルを全件読み取り。N コマンド名でN回のディスクI/O
- **対比**: `UsageHistoryManager` は in-memory Map キャッシュで O(1) なのに、こちらはキャッシュなし

#### C5. `searchAgents` にキャッシュなし
- **ファイル**: `src/renderer/mentions/mention-manager.ts`
- **問題**: 毎キーストロークで `electronAPI.agents.get(query)` + `getAgentUsageBonuses()` の2 IPC発行

#### C6. jq evaluation が毎サイクル17件失敗
- **ファイル**: `src/lib/jq-resolver.ts:54`
- **問題**: `~/.claude/teams/**/config.json` のjq式が常に失敗するのに毎サイクル評価。1ロードあたり17 WARNログ

### 改善計画（優先度順）

- [x] **C1**: `loadAll()` に loading promise guard (singleflight) を追加
- [x] **C2**: `showSuggestions` に 80ms デバウンスを追加
- [x] **C3**: `checkForFileSearch` / `checkForAgentSkill` にキーワード変化チェックを追加
- [x] **C4**: `AgentSkillCacheManager` に in-memory キャッシュを追加
- [x] **C5**: `searchAgents` に短期 TTL キャッシュ（2秒）を追加
- [x] **C6**: jq evaluation に失敗キャッシュを追加（30秒TTL）

---

## 第3次調査結果（2026-03-03）

第2次修正後、体感で若干の改善が見られた。E2E処理フロー全体を4つの並列エージェントで徹底調査し、残存ボトルネックを特定。

### 特定されたボトルネック一覧（優先度順）

#### P0: 不要な IPC ラウンドトリップの排除

##### D1. `getFileUsageBonuses` に TTL キャッシュなし（@ メンション）
- **ファイル**: `src/renderer/mentions/managers/suggestion-ui-manager.ts:293`
- **問題**: 毎キーストローク（デバウンス後も）で `getFileUsageBonuses()` IPC を呼び出し。AgentSkillManager には 5秒 TTL キャッシュがあるが、mention 側にはない
- **体感影響**: 高（IPC ラウンドトリップがキーストロークごとに発生）

##### D2. `getMaxSuggestions` IPC を毎回呼び出し
- **ファイル**: `src/renderer/mentions/managers/suggestion-ui-manager.ts:309`
- **問題**: セッション中ほぼ変わらない設定値（デフォルト20）を毎回 IPC で取得
- **体感影響**: 中（不要な IPC 1回分の遅延）

##### D3. `matchesSearchPrefix` IPC を毎回呼び出し
- **ファイル**: `src/renderer/mentions/managers/suggestion-ui-manager.ts:271`
- **問題**: 単純な文字列プレフィックスチェックなのに毎回 IPC。ローカルで実行可能
- **体感影響**: 中（不要な IPC 1回分の遅延）

#### P1: レンダラー側の不要な処理

##### D4. 入力イベントで3つのコールバックが毎回発火
- **ファイル**: `src/renderer/mentions/managers/event-listener-manager.ts:147-149`
- **問題**: `input` イベントごとに以下3つが全て実行:
  1. `checkForFileSearch()` - @ メンション検出
  2. `updateHighlightBackdrop()` - テキストエリア全文の @path 正規表現スキャン
  3. `updateCursorPositionHighlight()` - カーソル位置計算
- **改善**: サジェスト処理中は #2, #3 を遅延実行に変更可能
- **体感影響**: 高（毎キーストロークで3倍の処理）

##### D5. スラッシュコマンド `updateSelection` が `querySelectorAll` O(n)
- **ファイル**: `src/renderer/agent-skill-manager.ts:837`
- **問題**: キーボードナビゲーション時に全項目を走査して selected クラスを更新。メンション側は既に差分更新済みだが、スラッシュコマンド側は未対応
- **体感影響**: 中（矢印キー操作のたびに O(n) DOM 更新）

##### D6. `queryHighlightCache` がクエリ未変更でも毎レンダーで再構築
- **ファイル**: `src/renderer/mentions/managers/suggestion-ui-manager.ts:494-499`
- **問題**: `buildHighlightCache()` が毎レンダーで RegExp コンパイル。クエリが変わっていない場合はスキップ可能
- **体感影響**: 低〜中（RegExp コンパイルコスト）

##### D7. `splitKeywords` が `checkForAgentSkill` と `showSuggestions` で二重呼び出し
- **ファイル**: `src/renderer/agent-skill-manager.ts:354, 480`
- **問題**: C3 のキーワード変化チェックで一度 `splitKeywords` を呼び、`showSuggestions` 内で再度呼ぶ
- **体感影響**: 低（マイクロ秒レベルだが不要な処理）

#### P2: イベント処理の最適化

##### D8. `mousemove` ハンドラーにスロットルなし
- **ファイル**: `src/renderer/mentions/managers/event-listener-manager.ts:252`
- **問題**: テキストエリア上のマウス移動でピクセル単位のイベント発火。@path のリンクスタイル検出用だが、50-100ms のスロットルで十分
- **体感影響**: 中（マウス操作時のみ）

##### D9. コードサーチで `toLowerCase` を毎フィルターで再計算
- **ファイル**: `src/renderer/mentions/managers/code-search-manager.ts:541-547, 550-552`
- **問題**: シンボルの `name` と `lineContent` に対して毎フィルターで `toLowerCase()` 呼び出し。ソート内でも再呼び出し
- **改善**: シンボル読み込み時に小文字版を事前計算
- **体感影響**: 中（シンボル数が多い場合に顕著）

### 改善計画（優先度順）

#### Quick Win（即効性が高い）

- [x] **D1**: `getFileUsageBonuses` に TTL 5秒キャッシュを追加（AgentSkillManager と同パターン）
- [x] **D2**: `getMaxSuggestions` → 既に `SettingsCacheManager` で永続キャッシュ済み（変更不要）
- [x] **D3**: `matchesSearchPrefix` → 既に `SettingsCacheManager` でローカル処理済み（変更不要）
- [x] **D5**: スラッシュコマンドの `updateSelection` に差分更新を適用（`selectedElement` 参照パターン）
- [x] **D6**: `queryHighlightCache` にクエリ変化チェックを追加
- [x] **D7**: `checkForAgentSkill` で計算した keywords を `showSuggestions` に渡す

#### 中期改善

- [x] **D4**: 入力イベントコールバックの最適化（サジェスト処理中は highlight/cursor 更新を遅延）
- [x] **D8**: `mousemove` ハンドラーに 80ms スロットルを追加
- [x] **D9**: コードサーチのシンボルに小文字版フィールドを事前計算
