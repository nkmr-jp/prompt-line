# 🚀 無制限履歴機能 クイック負荷テスト

## 📦 すぐに始める (5分で完了)

### 1. テストデータ生成

```bash
# benchmarksディレクトリに移動
cd benchmarks

# 5,000件のテストデータを生成
node generate-test-history.js 5000

# 出力例:
# Generated 5000 items
# File size: 0.71 MB
# Average text length: 83 characters
```

### 2. 自動ベンチマーク実行

```bash
# 全ベンチマークを自動実行
node benchmark-history.js

# 約2-3分で完了
# 結果がコンソールに表示される
```

### 3. 実アプリケーションテスト

```bash
# 現在の履歴をバックアップ
cp ~/.prompt-line/history.jsonl ~/.prompt-line/history.jsonl.backup

# テストデータを使用
cp benchmarks/data/test-history-5000.jsonl ~/.prompt-line/history.jsonl

# 無制限履歴を有効化
echo "history:
  unlimited: true" >> ~/.prompt-line/settings.yml

# アプリケーション起動（起動時間を測定）
time npm start
```

### 4. 体感テスト

アプリ起動後：

1. `Cmd+Shift+Space` でアプリ開く
2. 検索テスト:
   - `function` → 即座に結果表示
   - `React` → 1-2秒で結果表示
   - `存在しないワード` → 数秒でメッセージ表示

### 5. クリーンアップ

```bash
# 元の履歴を復元
cp ~/.prompt-line/history.jsonl.backup ~/.prompt-line/history.jsonl

# テストファイルを削除
rm benchmarks/data/test-history-*.jsonl benchmarks/reports/benchmark-report-*.json
```

## 📊 期待される結果

| テスト項目 | 期待値 | 実測例 |
|------------|--------|--------|
| 起動時間 (5,000件) | < 100ms | ~5ms |
| 検索時間 (頻出ワード) | < 10ms | ~0.1ms |
| 検索時間 (希少ワード) | < 100ms | ~3ms |
| 追加時間 | < 5ms | ~0.1ms |
| メモリ使用量 | < 10MB | ~6MB |

## ⚡ カスタムテスト

### 大規模テスト

```bash
# 50,000件の大規模テスト
node generate-test-history.js 50000
cp benchmarks/data/test-history-50000.jsonl ~/.prompt-line/history.jsonl
time npm start
```

### 特定キーワードテスト

```bash
# 特定のキーワードを多く含むテストデータ
node -e "
const fs = require('fs');
const items = Array(1000).fill().map((_, i) => ({
  text: \`検索テスト用データ \${i} function test React\`,
  timestamp: Date.now() - i * 1000,
  id: Date.now().toString(36) + i
}));
fs.writeFileSync('benchmarks/data/search-test.jsonl', items.map(item => JSON.stringify(item)).join('\n'));
"
```

## 🔧 トラブルシューティング

### よくある問題

```bash
# メモリエラーの場合
NODE_OPTIONS="--max-old-space-size=8192" node benchmark-history.js

# 権限エラーの場合
chmod 644 ~/.prompt-line/history.jsonl

# アプリが起動しない場合
npm run compile && npm start
```

### 性能が悪い場合のチェックポイント

1. **ディスク容量**: 十分な空き容量があるか
2. **メモリ**: 他のアプリが大量メモリを使用していないか
3. **ファイルサイズ**: テストファイルが予想以上に大きくないか
4. **設定**: `unlimited: true` が正しく設定されているか

## 📈 結果の見方

### ベンチマーク結果例

```
🚀 Initialization Performance:
Items   Init Time(ms)   File Size(MB)   Cached Items
-----   -------------   -------------   ------------
5000    5.1             0.8             100

✅ 良好: 5ms < 100ms (目標値)
```

### 警告サイン

- 起動時間が1秒を超える → ファイルが大きすぎる可能性
- 検索時間が100ms以上 → データ構造の問題の可能性
- メモリ使用量が急激に増加 → メモリリークの可能性

---

💡 **ヒント**: 定期的にこのテストを実行して、性能回帰を早期発見しましょう！