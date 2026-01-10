# 🧑‍💻 Prompt Line
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nkmr-jp/prompt-line)

<!-- Keep these links. Translations will automatically update with the README. -->
[English](README.md) |
日本語

## 概要

**あらゆるコンテキストを検索、より良いプロンプトを**

Prompt Lineは、[Claude Code](https://github.com/anthropics/claude-code)、[Gemini CLI](https://github.com/google-gemini/gemini-cli)、[OpenAI Codex CLI](https://github.com/openai/codex)、[Aider](https://github.com/paul-gauthier/aider) などのAIコーディングエージェント向けに設計されたmacOSアプリです。コンテキストを素早く検索・挿入できるので、効果的なプロンプト作成に集中できます。

### 主な機能

**🔍 コンテキスト検索機能**
- **@ファイル検索** - ファイルパスを瞬時に検索・挿入
- **@シンボル検索** - 20以上の言語でコードシンボル(関数、クラス、型)を検索
- **@マークダウン検索** - エージェント、スキル、ナレッジベースを検索
- **スラッシュコマンド** - AIツールコマンドに素早くアクセス
- **履歴検索** - 過去のプロンプトを再利用・改良

**✍️ 集中できるプロンプト作成環境**
- 作業を邪魔しない専用のフローティング入力インターフェース
- 素早い起動(`Cmd+Shift+Space`)と貼り付け(`Cmd+Enter`)
- 音声入力の編集とマルチバイト文字入力に最適
- ドラフト自動保存で作業内容を失わない


## 機能

### 🔍 コンテキスト検索機能

#### @ファイル検索 - ファイルを瞬時に検索
`@`を入力してファイルパスを検索・挿入。<br>
Terminal.app、iTerm2、Ghostty、Warp、WezTerm、JetBrains IDE、VSCode、Cursor、Windsurf、Zedなどに対応。<br>
※ [fd](https://github.com/sharkdp/fd)コマンド(`brew install fd`)のインストールと設定が必要です。

![doc10.png](assets/doc10.png)

#### @シンボル検索 - コードをセマンティックに検索
`@<言語>:<クエリ>`を入力してコードシンボル(関数、クラス、型など)を検索。<br>
TypeScript、Go、Python、Rust、Javaなど20以上の言語に対応。<br>
※ [ripgrep](https://github.com/BurntSushi/ripgrep)(`brew install ripgrep`)のインストールとファイル検索の有効化が必要です。

**例:**
- `@ts:Config` - "Config"を含むTypeScriptシンボルを検索
- `@go:Handler` - "Handler"を含むGoシンボルを検索
- `@py:parse` - "parse"を含むPythonシンボルを検索

![doc13.png](assets/doc13.png)

#### @マークダウン検索 - ナレッジベースにアクセス
`@<検索プレフィックス>:<クエリ>`を入力してエージェント、スキル、ドキュメントを検索。<br>
設定で検索プレフィックスをカスタマイズして、独自のナレッジベースを構築できます。

![doc12.png](assets/doc12.png)

#### スラッシュコマンド - コマンドに素早くアクセス
`/`を入力してスラッシュコマンドを検索。<br>
Claude Code、OpenAI Codex、Google Gemini用のビルトインコマンドが利用可能。<br>
カスタムコマンドは`~/.prompt-line/settings.yml`で追加できます。

![doc11.png](assets/doc11.png)

#### 履歴検索 - 過去のプロンプトを再利用
すべてのプロンプトが保存され、検索可能(`Cmd+f`)。<br>
エントリをクリックするだけで即座に再利用できます。

![doc3.gif](assets/doc3.gif)

### ✍️ 集中できる作成環境

#### 素早い起動、素早い貼り付け
`Cmd+Shift+Space`でどこからでも起動。<br>
入力して`Cmd+Enter`で貼り付け。<br>
ターミナルだけでなく、すべてのアプリケーションで動作します。

![doc1.gif](assets/doc1.gif)

#### 音声入力に最適
一般的なテキストエディタと同じ操作性。<br>
Enterキーでテキストを送信せず改行できます。<br>
音声入力したテキストの編集に最適。<br>
(この動画では[superwhisper](https://superwhisper.com/)を使用しています。)

![doc2.gif](assets/doc2.gif)

#### ファイルオープン
ファイルパスや@mentionから直接ファイルを開けます。<br>
`Ctrl+Enter`または`Cmd+クリック`でファイル内容を確認。

![doc9.png](assets/doc9.png)

#### どこでも起動
テキスト入力フィールドがあればどこでも起動可能。<br>
異なるアプリケーション間でプロンプトを再利用するのに便利です。

![doc4.gif](assets/doc4.gif)
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
npm run reset-accessibility
```


## 📦 アップデート

既に古いバージョンをインストール済みで、最新版にアップデートする場合は以下の手順を実行してください。

1. `npm run reset-accessibility`のコマンドを実行して「Prompt Line」のアクセシビリティ権限をリセット
2. 「📦 インストール」の項目を参照して、再度インストール


## 使用方法

### 基本的なワークフロー
1. 入力したい場所に移動
2. `Cmd+Shift+Space`を押してPrompt Lineを開く
3. コンテキスト検索機能を使用(@ファイル、@シンボル、/コマンド、履歴)
4. プロンプトを入力
5. `Cmd+Enter`を押して貼り付け
6. 作業を継続

### クイックリファレンス

- **履歴パネル** - `Cmd+f`で検索、クリックで再利用
- **ドラフト自動保存** - 作業内容を自動的に保存
- **画像サポート** - `Cmd+V`でクリップボード画像を貼り付け
- **ファイルオープン** - `Ctrl+Enter`または`Cmd+クリック`でファイルを開く
- **コンテキスト検索**
  - `@` - ファイル検索
  - `@<言語>:` - シンボル検索(例: `@ts:Config`)
  - `@<プレフィックス>:` - マークダウン検索(例: `@agent:claude`)
  - `/` - スラッシュコマンド


## ⚙️ 設定

`~/.prompt-line/settings.yml`に設定ファイルを作成してPrompt Lineの動作をカスタマイズできます。

利用可能なすべてのオプションとコメント付きの完全な設定例については、以下を参照してください：
**[settings.example.yml](settings.example.yml)**

### 設定項目の概要

| セクション | 説明 |
|---------|-------------|
| `shortcuts` | キーボードショートカット（メイン、ペースト、クローズ、履歴ナビゲーション、検索） |
| `window` | ウィンドウサイズと配置モード |
| `fileOpener` | デフォルトエディタと拡張子別アプリケーション |
| `slashCommands` | 組み込みAIツールコマンド、カスタムスラッシュコマンド、スキル検索 |
| `mentions.fileSearch` | ファイル検索設定（@path/to/file補完） |
| `mentions.symbolSearch` | シンボル検索設定（@ts:Config、@go:Handler） |
| `mentions.mdSearch` | searchPrefixによるマークダウン検索（agent, rules, docs等）、frontmatterテンプレート変数対応 |

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
