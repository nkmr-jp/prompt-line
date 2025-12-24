# タスク完了時チェックリスト

## コード変更後の必須チェック

### 1. リンティング
```bash
npm run lint
```
- ESLintエラーがないこと
- 必要に応じて `npm run lint:fix` で自動修正

### 2. 型チェック
```bash
npm run typecheck
```
- TypeScriptコンパイルエラーがないこと

### 3. テスト
```bash
npm test
```
- 全テストが通過すること
- 新機能には対応するテストを追加

### 4. 動作確認 (必要に応じて)
```bash
npm start
```
- 開発モードで動作確認

## コミット前

### 自動実行 (pre-commit hook)
- ステージファイルへのESLint --fix
- TypeScript型チェック

### 手動確認
- コミットメッセージがAngular規約に準拠
- 変更が意図通りであること

## プッシュ前

### 自動実行 (pre-push hook)
- TypeScript型チェック
- 全テスト実行

### 手動確認 (推奨)
```bash
npm run pre-push
```

## リリース前

### フルビルド
```bash
npm run build
```
- DMGが正常に生成されること
- ネイティブツールが含まれていること

### 確認事項
- 新機能のドキュメント更新
- CHANGELOGの更新 (semantic-release経由)

## クリーンビルドが必要な場合

```bash
npm run clean:full
npm install
npm run build
```

## 注意事項

- `src/`のファイルは300行制限あり
- セキュリティ考慮事項を確認 (入力検証、パス検証等)
- 既存のコードスタイルとパターンに従う
