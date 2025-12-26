# コードスタイルと規約

## TypeScript設定

### コンパイラオプション (tsconfig.json)
- **Target**: ES2020
- **Module**: commonjs
- **Strict mode**: 有効
- **厳格な型チェック**:
  - `noImplicitAny`: true
  - `noImplicitReturns`: true
  - `noUnusedLocals`: true
  - `noUnusedParameters`: true
  - `exactOptionalPropertyTypes`: true
  - `noUncheckedIndexedAccess`: true

## ESLint設定

### ファイルサイズ制限
- `max-lines`: 300行 (warn) - 空行とコメント除く

### TypeScript ルール
- 未使用変数: `@typescript-eslint/no-unused-vars` (warn)
- `_`プレフィックスの引数は無視
- `no-explicit-any`: off (許可)
- `no-console`: off (許可)

## 命名規約

### ファイル名
- kebab-case: `window-manager.ts`, `file-search-manager.ts`
- テスト: `*.test.ts` または `*.test.js`

### コード
- クラス: PascalCase (`WindowManager`, `FileSearchManager`)
- 関数/メソッド: camelCase (`getHistory`, `saveSettings`)
- 定数: UPPER_SNAKE_CASE (`MAX_HISTORY_ITEMS`)
- 変数: camelCase (`historyItems`, `currentDirectory`)
- インターフェース: PascalCase (`IHistoryItem`, `WindowConfig`)
- 型: PascalCase (`PositionMode`, `FileSearchResult`)

## アーキテクチャパターン

### Manager Pattern
- 機能ごとに専門マネージャーを作成
- Main Process: `HistoryManager`, `WindowManager`, `SettingsManager`等
- Renderer Process: `DomManager`, `EventHandler`, `FileSearchManager`等

### IPC通信
- 専門ハンドラーに分離 (`paste-handler.ts`, `window-handler.ts`等)
- `IPCHandlers`がコーディネーター

### モジュール構造
- `index.ts`でpublic APIをexport
- `types.ts`で型定義を分離
- 内部実装は個別ファイル

## セキュリティ

- 入力のサニタイズ (AppleScript, パス)
- パストラバーサル防止
- プロトコルホワイトリスト (http/https)
- コンテキストブリッジによるIPC制限
