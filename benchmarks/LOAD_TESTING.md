# 無制限履歴機能 負荷テスト手順

## 📋 概要

このドキュメントでは、OptimizedHistoryManagerの性能評価を行うための負荷テスト手順を説明します。

## 🎯 テスト目標

- **起動性能**: 大量の履歴データがある場合の初期化時間
- **検索性能**: 様々なクエリでの検索レスポンス時間
- **追加性能**: 新しい履歴アイテムの追加速度
- **メモリ効率**: データサイズに対するメモリ使用量
- **ファイルサイズ制限**: 実用的なファイルサイズの上限確認

## 🛠️ 事前準備

### 1. 依存関係の確認

```bash
# プロジェクトディレクトリに移動
cd /path/to/prompt-line

# 依存関係がインストールされていることを確認
npm install

# TypeScriptコンパイルが正常に動作することを確認
npm run compile
```

### 2. テスト環境の設定

```bash
# 無制限履歴機能を有効化
echo "history:
  unlimited: true" >> ~/.prompt-line/settings.yml
```

## 📊 負荷テスト実行手順

### Step 1: テストデータの生成

様々なサイズのテストデータを生成します。

```bash
# benchmarksディレクトリに移動
cd benchmarks

# 小規模テスト (1,000件)
node generate-test-history.js 1000

# 中規模テスト (5,000件)
node generate-test-history.js 5000

# 大規模テスト (10,000件)
node generate-test-history.js 10000

# 超大規模テスト (50,000件) - 必要に応じて
node generate-test-history.js 50000

# カスタムサイズとファイル名指定
node generate-test-history.js 20000 data/custom-test.jsonl
```

**出力例:**
```
Generating 5000 history items...
Progress: 0%
Progress: 10%
...
Progress: 100%
Generated 5000 items
File size: 2.45 MB
Output: /path/to/prompt-line/benchmarks/data/test-history-5000.jsonl

Statistics:
  Average text length: 156 characters
  Min text length: 9 characters
  Max text length: 1247 characters
  Total characters: 780,432
```

### Step 2: ベンチマーク実行

自動化されたベンチマークを実行します。

```bash
# 全ベンチマークの実行
node benchmark-history.js
```

**実行されるテスト:**
1. **初期化性能テスト** - 異なるサイズのファイルでの起動時間測定
2. **検索性能テスト** - 様々なクエリでの検索時間測定
3. **追加性能テスト** - 新規アイテム追加の速度測定
4. **メモリ使用量テスト** - データサイズとメモリ消費の関係測定

### Step 3: 手動パフォーマンステスト

実際のアプリケーションでのテストも重要です。

#### 3.1 起動時間テスト

```bash
# 現在の履歴をバックアップ
cp ~/.prompt-line/history.jsonl ~/.prompt-line/history.jsonl.backup

# テストデータをコピー
cp benchmarks/data/test-history-10000.jsonl ~/.prompt-line/history.jsonl

# アプリケーション起動時間を測定
time npm start
```

#### 3.2 検索性能テスト

アプリケーション起動後：

1. `Cmd+Shift+Space`でアプリを開く
2. 検索テストを実行:
   - `function` - 一般的なキーワード
   - `React` - 特定のキーワード  
   - `テスト` - 日本語キーワード
   - `xyz123` - 存在しないキーワード

各検索の体感速度を記録します。

#### 3.3 追加性能テスト

```bash
# 大量の新しいアイテムを追加しながら動作確認
# アプリを使って実際にテキストを貼り付け、応答性を確認
```

### Step 4: 既存実装との比較

標準のHistoryManagerとの比較テストを実行します。

```bash
# 設定を標準履歴に変更
sed -i '' 's/unlimited: true/unlimited: false/' ~/.prompt-line/settings.yml

# 標準実装での起動時間測定
time npm start

# 無制限履歴に戻す
sed -i '' 's/unlimited: false/unlimited: true/' ~/.prompt-line/settings.yml
```

## 📈 パフォーマンス基準

### 期待される性能目標

| 項目 | 目標値 | 説明 |
|------|--------|------|
| 起動時間 (1,000件) | < 100ms | 小規模データでの初期化 |
| 起動時間 (10,000件) | < 500ms | 大規模データでの初期化 |
| 検索時間 | < 50ms | 一般的なキーワード検索 |
| 追加時間 | < 10ms | 新規アイテム追加 |
| メモリ使用量 | < 1MB/1000件 | キャッシュサイズを考慮した効率 |

### 警告レベル

| 項目 | 警告レベル | 対処が必要 |
|------|------------|------------|
| 起動時間 | > 1秒 | > 2秒 |
| 検索時間 | > 100ms | > 200ms |
| メモリ使用量 | > 2MB/1000件 | > 5MB/1000件 |

## 🔧 トラブルシューティング

### 一般的な問題

#### 1. メモリ不足エラー

```bash
# Node.jsのヒープサイズを増やす
NODE_OPTIONS="--max-old-space-size=8192" node benchmark-history.js
```

#### 2. ファイルサイズが大きすぎる

```bash
# より小さなテストデータを生成
node generate-test-history.js 1000
```

#### 3. 既存データとの競合

```bash
# 既存データをクリーンアップ
rm ~/.prompt-line/history.jsonl
rm benchmarks/data/test-history-*.jsonl
```

#### 4. 権限エラー

```bash
# ファイル権限を確認
ls -la ~/.prompt-line/
chmod 644 ~/.prompt-line/history.jsonl
```

### パフォーマンス問題の診断

#### CPU使用率の確認

```bash
# アプリ実行中にCPU使用率を監視
top -pid $(pgrep -f "prompt-line")
```

#### メモリ使用量の確認

```bash
# メモリ使用量を監視
ps -o pid,vsz,rss,comm -p $(pgrep -f "prompt-line")
```

#### ファイルI/O の確認

```bash
# ファイルアクセスを監視 (macOS)
sudo fs_usage -f pathname | grep prompt-line
```

## 📊 結果の解釈

### ベンチマーク結果例

```
📋 Performance Report

🚀 Initialization Performance:
Items   Init Time(ms)   File Size(MB)   Cached Items
-----   -------------   -------------   ------------
100     12.3            0.1             100
500     23.1            0.5             100
1000    45.2            1.2             100
5000    89.4            6.1             100
10000   156.7           12.3            100

🔍 Search Performance:
Query           Avg Time(ms)    Avg Results Min Time(ms)    Max Time(ms)
-----           ------------    ----------- ------------    ------------
function        8.2             5.2         6.1             12.3
test            12.1            8.7         9.4             16.8
React           4.3             2.1         3.2             6.7
デバッグ        15.2            3.4         12.1            19.3
xyz123          45.6            0.0         41.2            52.1

➕ Add Performance:
Individual adds:
  text_1: 2.34ms (10 chars)
  text_2: 3.12ms (78 chars)
  text_3: 4.56ms (245 chars)

Batch adds:
  batch_10: 2.87ms/item, 348 items/sec
  batch_50: 2.23ms/item, 448 items/sec
  batch_100: 1.98ms/item, 505 items/sec

💾 Memory Usage:
Items   Heap Used(MB)   Memory per Item(bytes)
-----   -------------   ---------------------
1000    0.85            878
5000    1.23            258
10000   1.87            196
```

### 結果の評価指標

1. **初期化時間**: ファイルサイズに対して線形に増加するか
2. **検索時間**: キーワードの種類や結果数による影響
3. **メモリ効率**: キャッシュサイズ制限が効いているか
4. **追加性能**: 新規アイテム追加が一定時間内に完了するか

## 🎯 継続的な性能監視

### 自動テストの設定

```bash
# 定期実行用のスクリプト作成（benchmarksディレクトリ内で実行）
cat > daily-performance-test.sh << 'EOF'
#!/bin/bash
echo "Daily performance test - $(date)"
cd "$(dirname "$0")"
node generate-test-history.js 5000 data/daily-test.jsonl
node benchmark-history.js > "reports/performance-log-$(date +%Y%m%d).txt"
echo "Test completed"
EOF

chmod +x daily-performance-test.sh
```

### 性能回帰の検出

```bash
# 前回の結果と比較
diff performance-log-20241201.txt performance-log-20241202.txt
```

## 📝 レポート作成

テスト結果は以下の形式でドキュメント化してください：

1. **テスト環境** - OS、Node.jsバージョン、メモリサイズ
2. **テストデータ** - ファイルサイズ、アイテム数、内容の種類
3. **測定結果** - 各種性能指標の数値
4. **分析** - 期待値との比較、ボトルネック箇所
5. **推奨事項** - パフォーマンス改善の提案

## 🚀 次のステップ

負荷テストの結果に基づいて：

1. **パフォーマンス最適化** - ボトルネックの改善
2. **キャッシュサイズ調整** - 最適なキャッシュサイズの決定
3. **制限値の設定** - 実用的なファイルサイズ上限の設定
4. **ドキュメント更新** - ユーザー向けの性能指標説明

---

💡 **ヒント**: 定期的な負荷テストにより、新機能追加時の性能回帰を早期に発見できます。