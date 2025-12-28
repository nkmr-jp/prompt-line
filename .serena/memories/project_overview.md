# Prompt Line - プロジェクト概要

## 概要
Prompt Lineは、Claude Code、OpenAI Codex CLI、AiderなどのCLIベースのAIコーディングエージェントでのプロンプト入力体験を向上させるmacOSアプリです。

## 技術スタック
- **言語**: TypeScript + Swift (ネイティブツール)
- **フレームワーク**: Electron 36.x
- **ビルドツール**: Vite, electron-builder
- **テスト**: Jest
- **リンター**: ESLint with TypeScript support
- **パッケージマネージャー**: npm

## アーキテクチャ
Electronの2プロセスモデル:
- **Main Process** (`src/main.ts`): アプリライフサイクル、ウィンドウ管理、システム操作
- **Renderer Process** (`src/renderer/`): UI、ユーザー操作
- **Preload Script** (`src/preload/preload.ts`): セキュアなIPC通信
- **IPC Handlers** (`src/handlers/`): 9つの専門ハンドラー (code-search含む)

### 主要ディレクトリ
```
src/
├── main.ts                # Electronメインプロセス
├── handlers/              # IPCハンドラー群
├── managers/              # メインプロセスマネージャー
│   ├── window/           # ウィンドウ管理
│   └── symbol-search/    # シンボル検索
├── renderer/             # レンダラープロセス
│   ├── file-search/      # @mentionファイル検索
│   ├── code-search/      # コード検索
│   ├── history-search/   # 履歴検索
│   └── styles/           # CSS
├── preload/              # プリロードスクリプト
├── native-tools/         # Swiftネイティブツール
├── config/               # アプリ設定
├── lib/                  # ライブラリ
└── utils/                # ユーティリティ
```

### ネイティブSwiftツール (native/)
- `window-detector`: アクティブウィンドウ検出
- `text-field-detector`: フォーカステキストフィールド検出
- `keyboard-simulator`: Cmd+Vシミュレーション
- `directory-detector`: カレントディレクトリ検出 (libproc使用、10-50x高速)
- `symbol-searcher`: コードシンボル検索 (ripgrep使用、20+言語対応)
- `file-searcher`: ファイル検索 (fd使用、.gitignore対応)

### 新規追加マネージャー
- `symbol-cache-manager`: シンボルキャッシュ管理 (言語別JSONL)
- `at-path-cache-manager`: @pathパターンキャッシュ

## 主な機能
- ペースト履歴管理 (無制限、JSONL形式)
- ドラフト自動保存 (適応的デバウンス)
- ファイル検索 (@mention)
- シンボル検索 (@language:query)
- スラッシュコマンド
- マルチモニター対応
