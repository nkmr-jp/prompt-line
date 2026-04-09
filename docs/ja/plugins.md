# プラグインガイド

プラグインはYAMLファイルで、Prompt Lineにエージェントスキル（`/`）、カスタム検索（`@prefix:`）、エージェント組み込みコマンドを追加します。

## セットアップ

prompt-lineプロジェクトディレクトリで以下を一度実行してください：

```bash
pnpm link
```

プラグインをインストール：

```bash
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
prompt-line-plugin install github.com/user/repo@branch   # バージョン指定
prompt-line-plugin help                                   # ヘルプ表示
```

---

## クイックスタート

ローカルディレクトリにYAMLファイルを配置するだけで利用可能。GitHubリポジトリは不要です。

### エージェントスキルを追加

`~/.prompt-line/agent-skills/my-skills.yaml` を作成：
```yaml
sourcePath: ~/my-project/skills/**/*/SKILL.md
name: "{frontmatter@name}"
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
```

入力欄で `/` を入力するとスキルが表示されます。

### カスタム検索を追加

`~/.prompt-line/custom-search/my-notes.yaml` を作成：
```yaml
sourcePath: ~/notes/**/*.md
name: "{basename}"
description: "{heading}"
searchPrefix: note
shortcut: Ctrl+n
```

`@note:` と入力するか `Ctrl+n` を押すとノートを検索できます。

### エージェント組み込みコマンドを追加

`~/.prompt-line/agent-built-in/my-tool.yaml` を作成：
```yaml
name: My Tool
color: blue
reference: https://example.com/docs
commands:
  - name: deploy
    description: 本番環境にデプロイ
  - name: rollback
    description: 前回のデプロイをロールバック
    argument-hint: "[version]"
skills:
  - name: test
    description: テストスイートを実行
agents:
  - name: reviewer
    description: コードレビューエージェント
```

---

## プラグインタイプ

| ディレクトリ | タイプ | トリガー | 用途 |
|-----------|------|---------|------|
| `agent-built-in/` | エージェント組み込み | `/`, `@` | CLIツールのコマンド、スキル、エージェントを定義 |
| `agent-skills/` | エージェントスキル | `/` | マークダウンファイル（SKILL.md等）からスキルを読み込み |
| `custom-search/` | カスタム検索 | `@prefix:` | ファイル、JSON、JSONL、コマンド出力を検索 |

---

## agent-built-in

`/` や `@` 入力時に表示されるコマンド、スキル、エージェントのリストを定義します。

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

---

## agent-skills

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

### フィールド

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

---

## custom-search

ファイル、コマンド、またはJSONソースから読み込む `@prefix:` 検索エントリを定義します。

```yaml
sourcePath: ~/.claude/agents/*.md
searchPrefix: agent
name: "{basename}(agent)"
label: global
description: "{frontmatter@description}"
displayTime: "{updatedAt}"
```

### 追加フィールド（custom-search専用）

| フィールド | 説明 |
|-------|-------------|
| `searchPrefix` | `@prefix:` 起動用プレフィックス |
| `displayTime` | タイムスタンプ表示テンプレート |
| `inputFormat` | 挿入フォーマットテンプレート |
| `shortcut` | 起動用キーボードショートカット |
| `runCommand` | Ctrl+Enterで実行するシェルコマンド |
| `excludeMarker` | このファイルを含むディレクトリをスキップ |

### ソースタイプ

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
| `{basename}` | 拡張子なしファイル名 | `SKILL.md` → `SKILL` |
| `{frontmatter@field}` | YAMLフロントマターフィールド | `{frontmatter@description}` |
| `{json@field}` | JSONフィールド（ドット記法） | `{json@display}` |
| `{json:N@field}` | N番目の親のJSONフィールド | `{json:1@name}` |
| `{heading}` | 最初のマークダウン見出し | |
| `{line}` | プレーンテキストの各行 | |
| `{content}` | ファイル全体の内容 | |
| `{filepath}` | 絶対ファイルパス | |
| `{dirname}` | 親ディレクトリ名 | |
| `{dirname:N}` | N階層上のディレクトリ | `{dirname:2}` |
| `{pathdir:N}` | ベースからN番目のディレクトリ | `{pathdir:1}` |
| `{latest}` | 最新の更新ディレクトリ | |
| `{updatedAt}` | ファイル更新日時 | |
| `{args.key}` | `args`フィールドの値 | `{args.open}` |

**フォールバック：** `{frontmatter@description}|{heading}` — 左側が空の場合、右側を使用。

---

## sourcePath フォーマット

ディレクトリとglobパターンを1つのフィールドで指定：

```yaml
sourcePath: ~/.claude/skills/**/*/SKILL.md    # 再帰glob
sourcePath: ~/.claude/commands/*.md           # シンプルなglob
sourcePath: ~/.claude/history.jsonl            # 特定ファイル
sourcePath: "~/.claude/teams/**/config.json@. | select(.active)"  # JSON + jq
```

### 分割ルール

`sourcePath` は最初のglob文字（`*`, `?`, `[`）でディレクトリ + パターンに分割されます：

| sourcePath | ディレクトリ | パターン |
|-----------|-----------|---------|
| `~/.claude/skills/**/*/SKILL.md` | `~/.claude/skills` | `**/*/SKILL.md` |
| `~/.claude/commands/*.md` | `~/.claude/commands` | `*.md` |
| `~/.claude/history.jsonl` | `~/.claude` | `history.jsonl` |

---

## カラー

バッジカラーは名前付きカラーと16進コードに対応：

**名前付き：** grey, darkGrey, slate, stone, red, rose, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink

**16進コード：** `#RGB` または `#RRGGBB`（例: `#FF6B35`, `#F63`）

---

## GitHubプラグインとして配布

プラグインを他のユーザーと共有するには、GitHubリポジトリを作成します：

```
my-plugins/
  my-tool/
    agent-built-in/en.yaml
    agent-skills/skills.yaml
    custom-search/search.yaml
```

### インストール

```bash
prompt-line-plugin install github.com/user/my-plugins
prompt-line-plugin install github.com/user/my-plugins@v1.0.0   # バージョン指定
prompt-line-plugin install ./local/path                         # ローカルパス
```

### settings.yaml で有効化

```yaml
plugins:
  github.com/user/my-plugins:
    - my-tool/agent-built-in/en
    - my-tool/agent-skills/skills
    - my-tool/custom-search/search@prefix    # @prefixでsearchPrefixを上書き
```

### パスの上書き

```
<path>[@searchPrefix][?key=value&key2=value2]
```

- `@suffix` → `searchPrefix` を上書き
- `?key=val` → `args` を上書き（例: `?open=iTerm`）

### プラグインディレクトリ構造

```
~/.prompt-line/plugins/
  <package>/                          # 例: github.com/nkmr-jp/prompt-line-plugins
    <category>/                       # 例: claude, codex, gemini
      agent-built-in/<name>.yaml
      agent-skills/<name>.yaml
      custom-search/<name>.yaml
```

### リポジトリ例 (prompt-line-plugins)

```
prompt-line-plugins/
  claude/
    agent-built-in/en.yaml          # Claude Code 組み込み（英語）
    agent-built-in/ja.yaml          # Claude Code 組み込み（日本語）
    agent-skills/commands.yaml      # ~/.claude/commands/*.md
    agent-skills/skills.yaml        # ~/.claude/skills/**/SKILL.md
    custom-search/agents.yaml       # @agent: 検索
    custom-search/history.yaml      # @r: Claude 履歴
    custom-search/teams.yaml        # @team: 検索
  codex/
    agent-built-in/en.yaml          # Codex CLI 組み込み
  gemini/
    agent-built-in/en.yaml          # Gemini CLI 組み込み
  path/
    custom-search/ghq.yaml          # @ghq: リポジトリ検索
```

---

## ホットリロード

すべてのYAMLファイルはchokidar（300msデバウンス）で監視されます。アプリ再起動なしで変更が自動検出されます。ローカルディレクトリとプラグインディレクトリの両方が対象です。
