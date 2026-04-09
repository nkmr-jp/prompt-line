# 🧑‍💻 Prompt Line
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nkmr-jp/prompt-line)

[English](README.md) |
日本語

## 概要

Prompt Lineは、[Claude Code](https://github.com/anthropics/claude-code)、[Gemini CLI](https://github.com/google-gemini/gemini-cli)、[OpenAI Codex CLI](https://github.com/openai/codex)、[Aider](https://github.com/paul-gauthier/aider) などのCLI型AIコーディングエージェントのターミナルでのプロンプト入力体験を改善することを目的として開発したmacOSアプリです。
CJK文字(中国語・日本語・韓国語)の入力時のUXの課題を専用のフローティング入力インターフェースで解決します。`/`や`@`によるコンテキスト検索と入力補完の機能も備えており、[YAMLプラグインシステム](docs/ja/plugins.md)で拡張可能です。

主な機能：

1. **サクッと入力、サクッと貼り付け** — `Cmd+Shift+Space`でフローティングウィンドウを起動、`Cmd+Enter`でどこにでも貼り付け
2. **コンテキスト検索** — `/`や`@`でエージェントスキル、ファイル、シンボルなどを検索。プロンプト履歴の再利用も可能
3. **プラグインで拡張** — シンプルなYAMLファイルや[プラグインリポジトリ](https://github.com/nkmr-jp/prompt-line-plugins)でカスタム検索やスキルを追加

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

`/`や`@`を入力するとエージェントスキル・組み込みコマンド・ファイル・シンボルなどのコンテキストを検索して入力補完できます。<br>
プラグインで拡張可能です。詳細: [プラグインガイド](docs/ja/plugins.md) | [prompt-line-plugins](https://github.com/nkmr-jp/prompt-line-plugins)
<table>
<tr>
<td>エージェントスキルと組み込みコマンド<img src="assets/doc9.png"> </td>
<td>ファイルとディレクトリ検索 <img src="assets/doc10.png"> </td>
</tr>
<tr>
<td>シンボル検索<img src="assets/doc11.png"> </td>
<td>カスタム検索 (@agent:, @plan: 等) <img src="assets/doc14.png"> </td>
</tr>
<tr>
<td>カスタム検索 (@plan:) <img src="assets/doc12.png"> </td>
<td>カスタム検索 (@team:)  <img src="assets/doc13.png"> </td>
</tr>
</table>

## 📦 インストール

### システム要件

- macOS 10.14以降
- Node.js 20以上
- [pnpm](https://pnpm.io/installation)
- Xcodeコマンドラインツール または Xcode（ネイティブツールのコンパイル用）
- [fd](https://github.com/sharkdp/fd) と [rg(ripgrep)](https://github.com/BurntSushi/ripgrep)（ファイル検索・シンボル検索機能で使用）

### Prompt Line の インストール

```bash
git clone https://github.com/nkmr-jp/prompt-line.git
cd prompt-line
git checkout v0.x.x  # 任意: 必要なバージョンタグに置き換え
pnpm install
pnpm run install-app    # ビルドして/Applicationsにインストール（コード署名セットアップ含む）
```

Prompt Lineを起動。システムトレーにアイコンが表示されます。

<div><img src="assets/doc6.png" width="200"></div>

`Cmd+Shift+Space`で使い始められます。

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

既に古いバージョンをインストール済みで、最新版にアップデートする場合:

```bash
git pull
pnpm install
pnpm run install-app
pnpm run migrate-settings        # 設定ファイルを最新のデフォルトに移行（自動バックアップ）
```

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
- **カスタム検索** - `@prefix:` でエージェント、プラン、チーム、履歴などを検索（[プラグイン](docs/ja/plugins.md)で拡張可能）

## ⚙️ 設定

設定ファイル: `~/.prompt-line/settings.yaml`（ホットリロード対応、再起動不要）

参照: [設定リファレンス](docs/ja/settings.md) | [settings.example.yaml](settings.example.yaml) | [マイグレーションガイド](docs/ja/migration.md)

## 🔌 プラグイン

プラグインはYAMLファイルで、エージェントスキル（`/`）、カスタム検索（`@prefix:`）、CLIツールの組み込みコマンド・スキル・エージェントを追加します。

**最も簡単な方法:** `~/.prompt-line/agent-skills/`、`~/.prompt-line/custom-search/`、`~/.prompt-line/agent-built-in/` にYAMLファイルを配置するだけ。GitHubリポジトリは不要です。

**GitHubで共有:** リポジトリからプラグインをインストール：

```bash
# グローバルCLIセットアップ（prompt-lineプロジェクトディレクトリで一度だけ実行）
pnpm link

# プラグインのインストール
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
prompt-line-plugin install github.com/user/repo@branch   # バージョン指定
```

**詳細:** [docs/ja/plugins.md](docs/ja/plugins.md)<br>
**リポジトリ例:** [prompt-line-plugins](https://github.com/nkmr-jp/prompt-line-plugins)

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
