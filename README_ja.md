<!-- Keep these links. Translations will automatically update with the README. -->
[English](README.md) |
日本語 |
[Deutsch](https://readme-i18n.com/nkmr-jp/prompt-line?lang=de) |
[English](https://readme-i18n.com/nkmr-jp/prompt-line?lang=en) |
[Español](https://readme-i18n.com/nkmr-jp/prompt-line?lang=es) |
[français](https://readme-i18n.com/nkmr-jp/prompt-line?lang=fr) |
[한국어](https://readme-i18n.com/nkmr-jp/prompt-line?lang=ko) |
[Português](https://readme-i18n.com/nkmr-jp/prompt-line?lang=pt) |
[Русский](https://readme-i18n.com/nkmr-jp/prompt-line?lang=ru) |
[中文](https://readme-i18n.com/nkmr-jp/prompt-line?lang=zh)

# 🧑‍💻 Prompt Line
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nkmr-jp/prompt-line)

macOS用フローティングテキスト入力ツール。あらゆるアプリケーションで素早くテキスト入力が可能です。

## 概要

Prompt Lineは、[Claude Code](https://github.com/anthropics/claude-code)、[Gemini CLI](https://github.com/google-gemini/gemini-cli)、[OpenAI Codex CLI](https://github.com/openai/codex)、[Aider](https://github.com/paul-gauthier/aider) などのCLI型AIコーディングエージェントのターミナルでのプロンプト入力体験を改善することを目的として開発したmacOSアプリです。
日本語などのマルチバイト文字入力時のUXの課題を専用のフローティング入力インターフェースで解決します。 

特に以下のようなケースでのテキスト入力のストレスを大幅に軽減します。

1. **ターミナルでのCLI型AIコーディングエージェントへのプロンプト入力**
2. **Enterを押したら意図しないタイミングで送信されてしまうチャットアプリ**
3. **入力の重たいテキストエディタ(例：巨大なコンフルエンスのドキュメントなど)**


## 特徴
### サクッと起動、サクッと貼付け
ショートカットでサクッと起動 (`Cmd+Shift+Space`)。<br>
テキスト入力してサクッと貼付け(`Cmd+Enter`)。
![doc1.gif](assets/doc1.gif)

### 音声入力したテキストの編集にも最適
操作性は一般的なテキストエディタと同じです。<br>
もちろん音声入力アプリと組み合わせて使うこともできます。<br>
Enterを押しても勝手に送信されないので、改行する場合も気をつける必要はありません。 <br>
音声入力したテキストの編集にも最適です。<br>
(この動画では[superwhisper](https://superwhisper.com/)を使っています。)
![doc2.gif](assets/doc2.gif)

### プロンプト履歴を検索して再利用可能
プロンプト履歴は保存されており、右のメニューから再利用可能です。<br>
検索もできます。(`Cmd+f`)
![doc3.gif](assets/doc3.gif)

### どこでも起動
テキスト入力フィールドであればどこでも起動できます。<br>
同じプロンプトを他のアプリで再利用したい場合にも便利です。
![doc1.gif](assets/doc4.gif)

もちろん、ターミナル以外でも使えます。
![doc5.gif](assets/doc5.gif)

## 📦 インストール

### システム要件

- macOS 10.14以降
- Node.js 20以上
- Xcodeコマンドラインツール または Xcode（ネイティブツールのコンパイル用）

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
   git checkout v0.x.x  # 必要なバージョンタグに置き換え
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
   open dist/Prompt-Line-0.x.x-arm64.dmg # Apple Silicon
   open dist/Prompt-Line-0.x.x-x64.dmg # Intel
   ```
6. Prompt Line.appをApplicationsフォルダにドラッグ
7. Prompt Lineを起動。システムトレーにアイコンが表示されます。
<div><img src="assets/doc6.png" width="200"></div>

8. `Cmd+Shift+Space`で使い始められます。

### アクセシビリティ権限

Prompt Lineが他のアプリケーションにテキストを貼り付けるには、アクセシビリティ権限が必要です。<br>
初回使用時にダイアログボックスが表示されるので、指示に従って設定してください。

<div><img src="assets/doc7.png" width="200"></div>

## トラブルシューティング

### アクセシビリティ権限のダイアログボックスが表示されない場合

1. **システム設定** → **プライバシーとセキュリティ** → **アクセシビリティ**を開く
2. リストから「Prompt Line」を見つけて有効にする
3. リストにない場合は「+」ボタンでApplicationsからPrompt Lineを追加

### アクセシビリティ権限で「Prompt Line」が有効になっているのに貼付けできない場合

1. **システム設定** → **プライバシーとセキュリティ** → **アクセシビリティ**を開く
2. 「-」ボタンでApplicationsからPrompt Lineを削除して権限をリセット
3. 再度設定すれば動くようになります。

アクセシビリティ権限のリセットは以下のコマンドでもできます。
```bash
npm run reset-accessibility
```

## 使用方法

### 基本的なワークフロー
1. 入力したい場所に移動
2. `Cmd+Shift+Space`を押してPrompt Lineを開く
3. テキストを入力
4. `Cmd+Enter`を押してテキストを貼り付け
5. 作業を継続

### 機能

- **履歴パネル** - 過去のエントリをクリックして再利用。検索も可能。
- **ドラフト自動保存** - 作業内容を自動的に保存
- **画像サポート** - `Cmd+V`でクリップボード画像を貼り付け

## ⚙️ 設定

`~/.prompt-line/settings.yml`に設定ファイルを作成してPrompt Lineの動作をカスタマイズできます：

```yaml
# Prompt Line Settings Configuration
# This file is automatically generated but can be manually edited

# Keyboard shortcuts configuration
shortcuts:
   # Global shortcut to show/hide the input window
   # Format: Modifier+Key (e.g., Cmd+Shift+Space, Ctrl+Alt+Space)
   # Available modifiers: Cmd, Ctrl, Alt, Shift
   main: Cmd+Shift+Space

   # Shortcut to paste selected text and close window
   # Used when typing in the input window
   paste: Cmd+Enter

   # Shortcut to close window without pasting
   # Used to cancel input and close window
   close: Escape

   # Shortcut to navigate to next history item
   # Used when browsing paste history
   historyNext: Ctrl+j

   # Shortcut to navigate to previous history item
   # Used when browsing paste history
   historyPrev: Ctrl+k

   # Shortcut to enable search mode in history
   # Used to filter paste history items
   search: Cmd+f

# Window appearance and positioning configuration
window:
   # Window positioning mode
   # Options:
   #   - 'active-text-field': Position near the currently focused text field (default, falls back to active-window-center)
   #   - 'active-window-center': Center within the currently active window
   #   - 'cursor': Position at mouse cursor location
   #   - 'center': Center on primary display
   position: active-text-field

   # Window width in pixels
   # Recommended range: 400-800 pixels
   width: 600

   # Window height in pixels
   # Recommended range: 200-400 pixels
   height: 300

```

## プロンプト履歴

- すべてのデータはMac内にローカル保存
- インターネット接続不要
- プロンプト履歴は `~/.prompt-line/history.jsonl` に保存
- JSON Lines形式で保存されているので[DuckDB](https://duckdb.org/)を使って分析することもできます。

![doc8.png](assets/doc8.png)

## 貢献

詳細は [Contribution Guide](CONTRIBUTING.md) をご確認ください。

## ライセンス

MIT License - 詳細は [LICENSE](./LICENSE) をご確認ください。
