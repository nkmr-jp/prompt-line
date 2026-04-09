# プラグインガイド

プラグインはYAMLファイルで、Prompt Lineにエージェントスキル（`/`）、カスタム検索（`@prefix:`）、CLIツールの組み込みコマンド・スキル・エージェントを追加します。

## セットアップ

prompt-lineプロジェクトディレクトリで以下を一度実行して、`prompt-line-plugin` コマンドをグローバルにインストールします：

```bash
pnpm link
```

これにより、任意のディレクトリから `prompt-line-plugin` コマンドが使えるようになります。

## プラグインの利用

公式プラグイン: [prompt-line-plugins](https://github.com/nkmr-jp/prompt-line-plugins)

### インストール

```bash
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
```

### settings.yaml で有効化

インストール後、使いたいエントリを `~/.prompt-line/settings.yaml` に追加します：

```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-built-in/en                  # 組み込みコマンド、スキル、エージェント | lang: en, ja
    - claude/agent-skills/commands              # sourcePath: ~/.claude/commands/*.md
    - claude/agent-skills/skills                # sourcePath: ~/.claude/skills/**/SKILL.md
    - claude/agent-skills/plugin-commands       # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/commands/*.md
    - claude/agent-skills/plugin-skills         # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/SKILL.md
    - claude/custom-search/agents@agent         # sourcePath: ~/.claude/agents/*.md
    - claude/custom-search/plans@plan           # sourcePath: ~/.claude/plans/*.md
    - claude/custom-search/plugin-agents@agent  # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/agents/*.md
    - claude/custom-search/teams@team           # sourcePath: ~/.claude/teams/**/config.json
    - claude/custom-search/history@r            # sourcePath: ~/.claude/history.jsonl
    # - codex/agent-built-in/en                 # Codex CLI 組み込み
    # - gemini/agent-built-in/en                # Gemini CLI 組み込み
    # - path/custom-search/ghq@ghq?open=iTerm   # sourceCommand: ghq list
```

### パスの上書き

settings.yaml のプラグインパスは上書きが可能です：

```
<path>[@searchPrefix][?key=value&key2=value2]
```

- `@suffix` → `searchPrefix` を上書き（例: `agents@agent` → `@agent:`）
- `?key=val` → `args` を上書き（例: `?open=iTerm`）

### ショートカットで起動

`searchPrefix` を設定したプラグインに、`settings.yaml` でキーボードショートカットを割り当てると直接起動できます：

```yaml
shortcuts:
  Ctrl+g: "input=@ghq:"    # Ctrl+g → @ghq: を挿入して検索を開始
  Ctrl+r: "input=@r:"      # Ctrl+r → @r: を挿入して履歴検索を開始
  Ctrl+n: "input=@note:"   # Ctrl+n → @note: を挿入してノート検索を開始
```

カスタムアクション `input=@prefix:` を使って、入力欄に検索プレフィックスを挿入し、プラグインの検索機能を起動します。

---

## プラグインの作成

### クイックスタート — ローカルYAML

`~/.prompt-line/` のサブディレクトリにYAMLファイルを配置するだけで利用できます：

```
~/.prompt-line/
  agent-built-in/     # 組み込みコマンド、スキル、エージェント (*.yaml)
  agent-skills/       # ファイルからのエージェントスキル (*.yaml)
  custom-search/      # カスタム検索エントリ (*.yaml)
```

**エージェントスキルの例** — `~/.prompt-line/agent-skills/my-skills.yaml`:
```yaml
sourcePath: ~/my-project/skills/**/*/SKILL.md
name: "{frontmatter@name}"
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
```

**カスタム検索の例** — `~/.prompt-line/custom-search/my-notes.yaml`:
```yaml
sourcePath: ~/notes/**/*.md
name: "{basename}"
description: "{heading}"
searchPrefix: note
```

**組み込みコマンドの例** — `~/.prompt-line/agent-built-in/my-tool.yaml`:
```yaml
name: My Tool
color: blue
reference: https://example.com/docs
commands:
  - name: deploy
    description: 本番環境にデプロイ
    argument-hint: "[env]"
skills:
  - name: test
    description: テストスイートを実行
agents:
  - name: reviewer
    description: コードレビューエージェント
```

### Gitリポジトリで管理

`~/.prompt-line/` に直接配置する代わりに、Gitリポジトリでプラグイン設定を管理できます。バージョン管理や複数マシンでの共有に便利です。GitHubリポジトリ、プライベートリポジトリ、ローカルリポジトリに対応しています。

カテゴリとタイプごとにYAMLファイルを整理したリポジトリを作成します：

```
my-plugins/
  my-tool/
    agent-built-in/en.yaml      # 組み込みコマンド、スキル、エージェント
    agent-skills/skills.yaml    # マークダウンファイルからのエージェントスキル
    custom-search/search.yaml   # カスタム検索エントリ
```

GitHubリポジトリ、バージョン指定、ローカルパスからインストール：

```bash
prompt-line-plugin install github.com/user/my-plugins
prompt-line-plugin install github.com/user/my-plugins@v1.0.0   # バージョン指定
prompt-line-plugin install ./local/path                         # ローカルパス
```

YAMLファイルは `~/.prompt-line/plugins/` にコピーされ、`settings.yaml` で有効化します（[settings.yaml で有効化](#settingsyaml-で有効化)を参照）。

---

## プラグインタイプ

| ディレクトリ | タイプ | トリガー | 用途 |
|-----------|------|---------|------|
| `agent-built-in/` | 組み込み | `/`, `@` | CLIツールのコマンド、スキル、エージェントを定義 |
| `agent-skills/` | エージェントスキル | `/` | マークダウンファイル（SKILL.md等）からスキルを読み込み |
| `custom-search/` | カスタム検索 | `@prefix:` | ファイル、JSON、JSONL、コマンド出力を検索 |

---

## YAMLリファレンス

### agent-built-in

```yaml
name: ツール名                         # 表示名
color: amber                          # バッジカラー
reference: https://example.com/docs   # 参照URL（単一）
references:                           # または複数URL
  - https://example.com/commands
  - https://example.com/skills
commands:
  - name: commit
    description: gitコミットを作成
    argument-hint: "[-m message]"
    color: green                      # アイテム個別のカラー上書き
skills:
  - name: batch
    description: バッチ操作を実行
agents:
  - name: Explore
    description: 高速コードベース探索
```

### agent-skills

マークダウンファイルからスキルを読み込みます。各YAMLは `.md` ファイル（通常は `SKILL.md`）のディレクトリに対応します。

```yaml
sourcePath: ~/.claude/skills/**/*/SKILL.md
name: "{frontmatter@name}"
label: global
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
```

コマンドにも対応：
```yaml
sourcePath: ~/.claude/commands/*.md
name: "{basename}"
description: "{frontmatter@description}"
```

#### フィールド

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `sourcePath` | No* | ソースファイルへのglobパス |
| `sourceCommand` | No* | データソース用シェルコマンド（sourcePathの代替） |
| `name` | Yes | 表示名テンプレート |
| `description` | No | 説明テンプレート |
| `label` | No | UIバッジラベル |
| `color` | No | バッジカラー |
| `icon` | No | Codiconアイコン名 |
| `argumentHint` | No | 引数ヒントテンプレート |
| `maxSuggestions` | No | 最大サジェスト数（デフォルト: 20） |
| `orderBy` | No | ソート順 |
| `values` | No | テンプレート変数パターン |
| `triggers` | No | トリガー文字（デフォルト: `["/"]`） |
| `args` | No | テンプレート引数 |

\* `sourcePath` または `sourceCommand` のいずれかが必要。

**カスタムトリガーの例：**
```yaml
sourcePath: ~/prompts/*.md
name: "{basename}"
description: "{heading}"
triggers: ["/", "$"]                  # / と $ の両方で起動
```

### custom-search

`@` に続けてプレフィックスを入力することで起動するカスタム検索エントリを定義します。例えば `searchPrefix: agent` と設定すると、入力欄で `@agent:` と入力して検索を開始できます。

```yaml
sourcePath: ~/.claude/agents/*.md
searchPrefix: agent                   # → @agent: と入力して検索
name: "{basename}(agent)"
label: global
description: "{frontmatter@description}"
displayTime: "{updatedAt}"
```

#### 追加フィールド（custom-search専用）

| フィールド | 説明 |
|-------|-------------|
| `searchPrefix` | 起動プレフィックス — `agent` に設定すると `@agent:` と入力して検索を開始 |
| `displayTime` | タイムスタンプ表示テンプレート |
| `inputFormat` | 挿入フォーマットテンプレート |
| `runCommand` | Ctrl+Enterで実行するシェルコマンド |
| `excludeMarker` | このファイルを含むディレクトリをスキップ |

#### ソースタイプ

**マークダウンファイル：**
```yaml
sourcePath: ~/docs/**/*.md
name: "{basename}"
description: "{frontmatter@description}|{heading}"
searchPrefix: doc
```

**JSONLファイル：**
```yaml
sourcePath: ~/.claude/history.jsonl
name: "{json@display}"
searchPrefix: r
orderBy: "{json@timestamp} desc"
displayTime: "{json@timestamp}"
```

**JSON + jq式：**
```yaml
sourcePath: "~/.claude/teams/**/config.json@.members"
name: "{json@name}"
description: "{json@prompt}"
searchPrefix: team
```

**コマンド出力：**
```yaml
sourceCommand: "ghq list"
name: "{line}"
searchPrefix: ghq
runCommand: "open -a {args.open} ~/ghq/{line}"
inputFormat: "~/ghq/{line}"
args:
  open: iTerm
```

- 出力フォーマット: プレーンテキスト（1行1アイテム）またはJSONL（1行1JSON）
- 出力の最初の行から自動判別

---

## テンプレート変数

| 変数 | 説明 | 例 |
|----------|-------------|---------|
| `{basename}` | 拡張子なしファイル名 | `commit.md` → `commit` |
| `{frontmatter@field}` | YAMLフロントマターフィールド | `{frontmatter@description}` |
| `{json@field}` | JSONフィールド値 | `{json@display}`, `{json@items[0].name}` |
| `{json:N@field}` | N番目の親のJSONフィールド | `{json:1@name}` |
| `{heading}` | 最初のマークダウン見出し | |
| `{line}` | プレーンテキストの各行 | |
| `{content}` | ファイル全体の内容 | |
| `{filepath}` | 絶対ファイルパス | |
| `{dirname}` | 親ディレクトリ名 | |
| `{dirname:N}` | N階層上のディレクトリ | `{dirname:2}` |
| `{pathdir:N}` | sourcePathのベースからN番目のディレクトリ | 例: `sourcePath: ~/a/b/*/file.md` → ベース=`~/a/b`、`{pathdir:1}`=ベース直下のディレクトリ |
| `{latest}` | 最新の更新ディレクトリ | |
| `{updatedAt}` | ファイル更新日時 | |
| `{args.key}` | `args`フィールドの値 | `{args.open}` |

**フォールバック：** `{frontmatter@description}|{heading}` — 左側が空の場合、右側を使用。

## sourcePath フォーマット

ディレクトリとglobパターンを1つのフィールドで指定：

```yaml
sourcePath: ~/.claude/skills/**/*/SKILL.md    # 再帰glob
sourcePath: ~/.claude/commands/*.md           # シンプルなglob
sourcePath: ~/.claude/history.jsonl            # 特定ファイル
sourcePath: "~/.claude/teams/**/config.json@. | select(.active)"  # JSON + jq
```

## カラー

バッジカラーは名前付きカラーと16進コードに対応：

**名前付き：** grey, darkGrey, slate, stone, red, rose, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink

**16進コード：** `#RGB` または `#RRGGBB`（例: `#FF6B35`, `#F63`）

## ホットリロード

すべてのYAMLファイルはchokidar（300msデバウンス）で監視されます。アプリ再起動なしで変更が自動検出されます。ローカルディレクトリとプラグインディレクトリの両方が対象です。
