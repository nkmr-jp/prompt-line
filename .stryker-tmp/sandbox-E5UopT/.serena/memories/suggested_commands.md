# 推奨コマンド

## 開発

### 開発サーバー起動
```bash
npm start          # DEBUGログ有効で開発モード起動
```

### コンパイル
```bash
npm run compile    # TypeScript + Vite + ネイティブツール
```

## テスト

```bash
npm test                    # 全テスト実行
npm run test:watch         # ウォッチモード
npm run test:coverage      # カバレッジ生成
npm run test:unit          # ユニットテストのみ
npm run test:integration   # 統合テストのみ
npm test -- --testNamePattern="パターン"  # 特定テスト実行
```

## コード品質

```bash
npm run lint       # ESLintチェック
npm run lint:fix   # ESLint自動修正
npm run typecheck  # TypeScript型チェック
npm run pre-push   # 全チェック (lint + typecheck + test)
```

## ビルド

```bash
npm run build      # アプリケーションビルド (DMG生成)
npm run clean      # ビルド成果物削除
npm run clean:cache    # キャッシュ削除
npm run clean:full     # 完全クリーンアップ
```

## その他

```bash
npm run reset-accessibility  # アクセシビリティ権限リセット
```

## Git Hooks (husky)

### Pre-commit
- ステージされた.js/.tsファイルにESLint --fix実行
- TypeScript型チェック

### Pre-push
- TypeScript型チェック
- 全テスト実行

## コミットメッセージ規約 (Angular Commit Convention)

```
<type>(<scope>): <subject>
```

Types:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `refactor`: リファクタリング
- `perf`: パフォーマンス改善
- `test`: テスト
- `chore`: ビルド/ツール変更

例:
```
feat(history): add search functionality
fix(window): resolve positioning issue
```

## システムコマンド (macOS/Darwin)

```bash
ls -la              # ディレクトリ一覧
find . -name "*.ts" # ファイル検索
grep -r "pattern"   # パターン検索
git status          # Git状態
git diff            # 変更差分
```
