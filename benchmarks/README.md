# 📊 ベンチマーク・負荷テスト

無制限履歴機能（OptimizedHistoryManager）の性能評価とベンチマークテストのディレクトリです。

## 📁 ディレクトリ構造

```
benchmarks/
├── README.md                   # このファイル
├── LOAD_TESTING.md            # 詳細な負荷テスト手順書
├── QUICK_LOAD_TEST.md         # 5分で完了するクイックテスト
├── generate-test-history.js   # テストデータ生成スクリプト
├── benchmark-history.js       # ベンチマーク実行スクリプト
├── data/                      # テストデータ
│   ├── test-history-100.jsonl
│   ├── test-history-500.jsonl
│   ├── test-history-1000.jsonl
│   ├── test-history-5000.jsonl
│   ├── test-history-10000.jsonl
│   └── (その他生成されたテストデータ)
└── reports/                   # ベンチマーク結果レポート
    └── benchmark-report-YYYY-MM-DDTHH-MM-SS.json
```

## 🚀 クイックスタート

### 1. テストデータ生成

```bash
# benchmarksディレクトリで実行
cd benchmarks
node generate-test-history.js 5000
```

### 2. ベンチマーク実行

```bash
# 自動ベンチマークの実行
node benchmark-history.js
```

### 3. 実アプリテスト

```bash
# テストデータで実アプリを試す
cp benchmarks/data/test-history-5000.jsonl ~/.prompt-line/history.jsonl
npm start
```

## 📋 テストの種類

### 自動ベンチマーク

| テスト項目 | 説明 | 測定内容 |
|------------|------|----------|
| **初期化性能** | 起動時のデータ読み込み速度 | 100〜10,000件での初期化時間 |
| **検索性能** | キーワード検索の応答速度 | 様々なクエリでの検索時間 |
| **追加性能** | 新規アイテム追加の速度 | 個別追加・バッチ追加の時間 |
| **メモリ効率** | データサイズ対メモリ使用量 | 各サイズでのメモリ消費量 |

### 手動テスト

- **体感性能テスト** - 実際のアプリでの操作感
- **UI応答性テスト** - 検索・スクロールの滑らかさ
- **大容量データテスト** - 50,000件以上での動作確認

## 📊 期待される性能指標

| 項目 | 小規模 (1,000件) | 中規模 (5,000件) | 大規模 (10,000件) |
|------|------------------|------------------|-------------------|
| **起動時間** | < 50ms | < 100ms | < 200ms |
| **検索時間** | < 10ms | < 20ms | < 50ms |
| **追加時間** | < 5ms | < 5ms | < 5ms |
| **メモリ使用量** | < 1MB | < 2MB | < 3MB |

## 🔧 スクリプトの使用方法

### テストデータ生成

```bash
# benchmarksディレクトリで実行
cd benchmarks

# 基本的な使用方法
node generate-test-history.js [件数] [出力ファイル]

# 例
node generate-test-history.js 1000                           # 1000件、自動命名
node generate-test-history.js 5000 data/custom-test.jsonl   # カスタムファイル名
```

#### 生成される履歴アイテムの形式
```json
{
  "text": "サンプルテキスト",
  "timestamp": 1234567890123,
  "id": "abc123xyz",
  "appName": "Code"  // オプション: ソースアプリケーション名
}
```

**appName フィールドについて:**
- 約70%のアイテムにはappNameが含まれます（実際の使用パターンをシミュレート）
- 以下のようなアプリケーション名が含まれます:
  - Terminal / iTerm2
  - Code / Sublime Text
  - Slack / Discord
  - Chrome / Safari / Firefox
  - その他多数のmacOSアプリケーション

### ベンチマーク実行

```bash
# 全テストの実行
node benchmark-history.js

# 結果は以下に保存される:
# - コンソール出力: リアルタイム結果
# - JSONファイル: reports/benchmark-report-*.json
```

## 📈 結果の解釈

### ベンチマーク結果例

```
🚀 Initialization Performance:
Items   Init Time(ms)   File Size(MB)   Cached Items
-----   -------------   -------------   ------------
1000    1.4             0.2             100
5000    5.1             0.8             100
10000   10.0            1.6             100
```

### 評価基準

- ✅ **良好**: 初期化時間が目標値以下
- ⚠️ **要注意**: 目標値の2倍以内
- ❌ **問題**: 目標値の2倍を超過

## 🎯 継続的なテスト

### 定期実行の設定

```bash
# 日次性能テストのスクリプト例
cat > daily-benchmark.sh << 'EOF'
#!/bin/bash
echo "Daily benchmark - $(date)"
cd "$(dirname "$0")"
node generate-test-history.js 5000
node benchmark-history.js > "reports/daily-$(date +%Y%m%d).txt"
EOF

chmod +x daily-benchmark.sh
```

### 性能回帰の検出

```bash
# 前回結果との比較
diff reports/daily-20241201.txt reports/daily-20241202.txt
```

## 🔍 トラブルシューティング

### よくある問題

1. **メモリ不足エラー**
   ```bash
   NODE_OPTIONS="--max-old-space-size=8192" node benchmark-history.js
   ```

2. **権限エラー**
   ```bash
   chmod 755 data/
   chmod 644 data/*.jsonl
   ```

3. **ファイルが見つからない**
   ```bash
   # ディレクトリ構造を確認
   ls -la .
   ```

### 性能問題の診断

```bash
# CPU使用率の監視
top -pid $(pgrep -f "prompt-line")

# メモリ使用量の監視  
ps -o pid,vsz,rss,comm -p $(pgrep -f "prompt-line")

# ファイルアクセスの監視 (macOS)
sudo fs_usage -f pathname | grep prompt-line
```

## 📄 レポートの活用

### JSONレポートの構造

```json
{
  "initialization": {
    "1000": {
      "initTime": 1.4,
      "fileSize": 165059,
      "totalItems": 1000,
      "cachedItems": 100
    }
  },
  "search": {
    "function": {
      "avgSearchTime": 0.1,
      "avgResults": 10.0
    }
  },
  "add": {
    "individual": {...},
    "batch": {...}
  },
  "memory": {
    "1000": {
      "memoryDiff": {...},
      "memoryPerItem": 834
    }
  }
}
```

### 結果の可視化

レポートデータを使用して、パフォーマンスの傾向をグラフ化したり、時系列での変化を追跡できます。

---

💡 **ヒント**: 新機能追加後は必ずベンチマークを実行して、性能回帰がないことを確認しましょう。