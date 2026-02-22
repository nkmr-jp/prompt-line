# 🧑‍💻 Prompt Line
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nkmr-jp/prompt-line)

[English](README.md) |
日本語

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

### コンテキスト検索と入力補完

`/`や`@`を入力するとAgent Skills・Built in Commands ・ファイル・シンボルなどのコンテキストを検索して入力補完できます。<br>
これらは設定ファイル(`~/.prompt-line/settings.yml`)でカスタマイズできます。参考: [settings.example.yml](settings.example.yml)
<table>
<tr>
<td>Agent SkillsとBuilt in Commands <img src="assets/doc9.png"> </td>
<td>ファイルとディレクトリ検索 <img src="assets/doc10.png"> </td>
</tr>
<tr>
<td>シンボル検索<img src="assets/doc11.png"> </td>
<td>サブエージェント検索(~/.claude/agents)  <img src="assets/doc14.png"> </td>
</tr>
<tr>
<td>プラン検索(~/.claude/plans) <img src="assets/doc12.png"> </td>
<td>エージェントチーム検索(~/.claude/teams)  <img src="assets/doc13.png"> </td>
</tr>
</table>

## 📦 インストール

### コマンドインストール

[fd](https://github.com/sharkdp/fd)と[rg(ripgrep)](https://github.com/BurntSushi/ripgrep)コマンドのインストール。ファイル検索やシンボル検索の機能で使います。
```bash
brew install fd ripgrep
```

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
   pnpm install
   ```

3. アプリケーションをビルド:
   ```bash
   pnpm run build
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

### トラブルシューティング

#### アクセシビリティ権限のダイアログボックスが表示されない場合

1. **システム設定** → **プライバシーとセキュリティ** → **アクセシビリティ**を開く
2. リストから「Prompt Line」を見つけて有効にする
3. リストにない場合は「+」ボタンでApplicationsからPrompt Lineを追加

#### アクセシビリティ権限で「Prompt Line」が有効になっているのに貼付けできない場合

1. **システム設定** → **プライバシーとセキュリティ** → **アクセシビリティ**を開く
2. 「-」ボタンでApplicationsからPrompt Lineを削除して権限をリセット
3. 再度設定すれば動くようになります。

アクセシビリティ権限のリセットは以下のコマンドでもできます。
```bash
pnpm run reset-accessibility
```


## 📦 アップデート

既に古いバージョンをインストール済みで、最新版にアップデートする場合は以下の手順を実行してください。

1. `pnpm run reset-accessibility`のコマンドを実行して「Prompt Line」のアクセシビリティ権限をリセット
2. 「📦 インストール」の項目を参照して、再度インストール
3. `pnpm run migrate-settings`を実行して設定ファイルを最新のデフォルトに移行（既存設定は自動バックアップされます）
4. `pnpm run update-built-in-commands`を実行してビルトインコマンドを最新版に更新


## 使用方法

### 基本的なワークフロー
1. 入力したい場所に移動
2. `Cmd+Shift+Space`を押してPrompt Lineを開く
3. テキストを入力
4. `Cmd+Enter`を押してテキストを貼り付け
5. 作業を継続

### 機能

- **履歴パネル** - 過去のエントリをクリックして再利用。検索も可能。(`Cmd+f`)
- **ドラフト自動保存** - 作業内容を自動的に保存
- **画像サポート** - `Cmd+V`でクリップボード画像を貼り付け
- **ファイルオープン** - ファイルパスのテキストからファイルを起動 (`Ctrl+Enter` or `Cmd+クリック`)
- **ファイル検索** - `@`を入力してファイルを検索
- **シンボル検索** - `@<言語>:<クエリ>`と入力してコードシンボルを検索 (例: `@ts:Config`)
- **カスタム検索** - `/`を入力してSlash CommandsやAgent Skillsを検索、または`@`でサブエージェントを検索

## ⚙️ 設定

`~/.prompt-line/settings.yml`に設定ファイルを作成してPrompt Lineの動作をカスタマイズできます。

利用可能なすべてのオプションとコメント付きの完全な設定例については、以下を参照してください：
**[settings.example.yml](settings.example.yml)**

### 設定項目の概要

| セクション | 説明                                            |
|---------|-----------------------------------------------|
| `shortcuts` | キーボードショートカット（メイン、ペースト、クローズ、履歴ナビゲーション、検索）      |
| `window` | ウィンドウサイズと配置モード                                |
| `fileOpener` | デフォルトエディタと拡張子別アプリケーション                        |
| `builtInCommands` | Built-inスラッシュコマンドの有効化（claude, codex, gemini等） |
| `agentSkills` | Agent Skills検索機能                              |
| `mentions.customSearch` | @prefix:で発動するカスタム検索                           |
| `mentions.fileSearch` | ファイル検索設定（@path/to/file補完）                     |
| `mentions.symbolSearch` | シンボル検索設定（@ts:Config、@go:Handler）              |

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
