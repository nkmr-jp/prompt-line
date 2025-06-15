[English](README.md) | [日本語](README_ja.md)

# Prompt Line

macOS用フローティングテキスト入力ツール。あらゆるアプリケーションで素早くプロンプトの入力が可能です。

## 概要

Prompt Lineは、[Claude Code](https://github.com/anthropics/claude-code)、[OpenAI Codex CLI](https://github.com/openai/codex)、[aider](https://github.com/paul-gauthier/aider) などのCLI型AIコーディングエージェントでのターミナル入力体験を改善するmacOSアプリです。
日本語などのマルチバイト文字入力時の課題を、専用のフローティング入力インターフェースで解決します。ターミナルでのAIコーディングに特化していますが、Enterキーで即送信されるチャットアプリなど、日本語入力に配慮されていない様々なアプリケーションでも快適に使用できます。

## 動作方法

1. `Cmd+Shift+Space`を押す → 入力ウィンドウが表示
2. テキストを入力 → 複数行対応、画像貼付け対応、自動保存機能付き  
3. `Cmd+Enter`を押す → アクティブなアプリケーションにテキストを貼り付け
4. ウィンドウは自動的に非表示

## 📦 インストール

### ソースからビルド

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/nkmr-jp/prompt-line.git
   cd prompt-line
   ```

   特定のバージョンをビルドする場合:
   ```bash
   git clone https://github.com/nkmr-jp/prompt-line.git
   cd prompt-line
   git checkout v0.2.1  # 必要なバージョンタグに置き換え
   ```

2. 依存関係をインストール:
   ```bash
   npm install
   ```

3. アプリケーションをビルド:
   ```bash
   npm run build
   ```

4. ビルドされたアプリは `dist/` ディレクトリに作成されます
5. dmgファイルを開く
   ```bash
   open dist/Prompt-Line-0.2.1-arm64.dmg # Apple Silicon
   open dist/Prompt-Line-0.2.1-x64.dmg # Intel
   ```
6. Prompt Line.appをApplicationsフォルダにドラッグ
7. **アクセシビリティ権限を許可**（初回使用時、貼り付けに必要）
8. アプリを起動
9. 完了！ `Cmd+Shift+Space`で使い始められます

### アクセシビリティ権限

Prompt Lineが他のアプリケーションにテキストを貼り付けるには、アクセシビリティ権限が必要です：

1. アプリ初回実行時にmacOSが権限ダイアログを表示
2. 「システム設定を開く」（macOS 13以降）または「システム環境設定を開く」（macOS 12以前）をクリック
3. 「Prompt Line」の横のスイッチをONにする
4. 必要に応じてアプリを再起動

**手動設定:**
1. **システム設定** → **プライバシーとセキュリティ** → **アクセシビリティ**を開く
2. リストから「Prompt Line」を見つけて有効にする
3. リストにない場合は「+」ボタンでApplicationsからPrompt Lineを追加

## 使用方法

### 基本的なワークフロー
1. 入力したい場所に移動
2. `Cmd+Shift+Space`を押してPrompt Lineを開く
3. テキストを入力（複数行対応）
4. `Cmd+Enter`を押してテキストを貼り付け
5. 作業を継続

### 機能

- **履歴パネル** - 過去のエントリをクリックして再利用
- **ドラフト自動保存** - 作業内容を自動的に保存
- **検索** - 過去に入力したテキストを検索
- **画像サポート** - `Cmd+V`でクリップボード画像を貼り付け

### キーボードショートカット

| キー | アクション |
|-----|--------|
| `Cmd+Shift+Space` | Prompt Lineを開く |
| `Cmd+Enter` | 貼り付けて閉じる |
| `Esc` | 閉じる（ドラフト保存） |

## ⚙️ 設定

`~/.prompt-line/settings.yaml`に設定ファイルを作成してPrompt Lineの動作をカスタマイズできます：

```yaml
shortcuts:
  main: "Cmd+Shift+Space"    # Prompt Lineを開くグローバルショートカット
  paste: "Cmd+Enter"         # テキストを貼り付けてウィンドウを閉じる
  close: "Escape"            # ウィンドウを閉じる（ドラフト保存）

window:
  position: "cursor"         # ウィンドウ位置："cursor"（デフォルト）、"active-window-center"、または"center"
  width: 600                 # ウィンドウ幅（ピクセル）
  height: 300                # ウィンドウ高さ（ピクセル）
```

**設定オプション：**

- **ショートカット**: 形式：`Cmd`、`Ctrl`、`Alt`、`Shift` + 任意のキー
- **ウィンドウ位置**: `cursor`（デフォルト）、`active-window-center`、または`center`

## 開発

### ビルド要件

- **macOS**（ネイティブツールのコンパイルに必要）
- **Node.js 20以上**
- **Xcodeコマンドラインツール** または **Xcode**
  ```bash
  xcode-select --install  # コマンドラインツールをインストール
  ```

### コマンド
```bash
npm run dev          # ホットリロード付き開発モード
npm test             # テスト実行
npm run lint         # コードリンティング
npm run typecheck    # TypeScript型チェック
npm run build        # macOSアプリケーションビルド（両アーキテクチャ）
npm run build:x64    # Intel Mac用ビルド
npm run build:arm64  # Apple Silicon Mac用ビルド
```

### アーキテクチャ
Electron + TypeScriptでManager Patternを使用して構築：

- **WindowManager** - ウィンドウライフサイクルと配置
- **HistoryManager** - 重複除去機能付きJSONLベース永続ストレージ
- **DraftManager** - バックアップシステム付きデバウンス自動保存
- **SettingsManager** - ユーザー設定と構成
- **IPCHandlers** - メイン/レンダラープロセス間通信

## システム要件

### ユーザー向け
- macOS 10.14以降
- 100MBの利用可能ディスク容量

### 開発者向け
- macOS 10.14以降
- Node.js 20以上
- Xcodeコマンドラインツール または Xcode（ネイティブツールのコンパイル用）

## プライバシー

- すべてのデータはMac内にローカル保存
- インターネット接続不要
- テキスト履歴は `~/.prompt-line/` に保存

## 📄 ライセンス

MIT License - 詳細は[LICENSE](./LICENSE)をご覧ください。
