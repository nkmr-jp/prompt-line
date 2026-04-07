# プラグイン YAML リファレンス

プラグインは `~/.prompt-line/plugins/` にインストールされるYAMLファイルで、エージェントスキル、カスタム検索エントリ、エージェント組み込みコマンドを定義します。

## ディレクトリ構造

```
~/.prompt-line/plugins/
  <package>/                          # 例: github.com/nkmr-jp/prompt-line-plugins
    <category>/                       # 例: claude, codex, gemini
      agent-built-in/<name>.yaml      # → CLIツールのエージェントスキル
      agent-skills/<name>.yaml        # → マークダウンファイルからのエージェントスキル
      custom-search/<name>.yaml       # → @prefix: カスタム検索エントリ
```

## プラグインタイプ

### agent-built-in

CLIツール（Claude Code, Codex, Gemini）の組み込みエージェントスキル、スキル、エージェントを定義します。

```yaml
name: Claude Code                     # 表示名
color: amber                          # バッジカラー
reference: https://code.claude.com/docs/en/commands
references:                           # 複数の参照URL
  - https://code.claude.com/docs/en/commands
  - https://code.claude.com/docs/en/skills
commands:
  - name: commit
    description: gitコミットを作成
    argument-hint: "[-m message]"
    color: green                      # コマンド個別のカラー上書き
skills:
  - name: batch
    description: バッチ操作を実行
agents:
  - name: Explore
    description: 高速コードベース探索エージェント
```

### agent-skills

マークダウンファイルから読み込むエージェントスキルを定義します。各YAMLは`.md`ファイルのディレクトリに対応します。

```yaml
# Claude Code グローバルコマンド
sourcePath: ~/.claude/commands/*.md
name: "{basename}"
label: global
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
```

#### フィールド

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `sourcePath` | No* | ソースファイルへのglobパス（例: `~/.claude/commands/*.md`） |
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

### custom-search

ファイル、コマンド、またはJSONソースから読み込む `@prefix:` 検索エントリを定義します。

```yaml
# Claude Code グローバルエージェント
sourcePath: ~/.claude/agents/*.md
searchPrefix: agent
name: "{basename}(agent)"
label: global
description: "{frontmatter@description}"
displayTime: "{updatedAt}"
```

#### 追加フィールド（custom-search専用）

| フィールド | 説明 |
|-------|-------------|
| `searchPrefix` | `@prefix:` 起動用プレフィックス |
| `displayTime` | タイムスタンプ表示テンプレート |
| `inputFormat` | 挿入フォーマットテンプレート |
| `shortcut` | 起動用キーボードショートカット |
| `runCommand` | Ctrl+Enterで実行するシェルコマンド |
| `excludeMarker` | このファイルを含むディレクトリをスキップ |

## sourcePath フォーマット

ディレクトリとglobパターンを1つのフィールドで指定：

```yaml
# シンプルなglob
sourcePath: ~/.claude/commands/*.md

# 再帰glob
sourcePath: ~/.claude/skills/**/*/SKILL.md

# 特定ファイル
sourcePath: ~/.claude/history.jsonl

# jq式付き（JSON/JSONL）
sourcePath: "~/.claude/teams/**/config.json@. | select(.createdAt / 1000 > (now - 86400))"

# コマンドソース（sourcePathの代わりにsourceCommand）
sourceCommand: "ghq list"
```

### 分割ルール

`sourcePath` は最初のglob文字（`*`, `?`, `[`）でディレクトリ + パターンに分割されます：

| sourcePath | ディレクトリ | パターン |
|-----------|-----------|---------|
| `~/.claude/commands/*.md` | `~/.claude/commands` | `*.md` |
| `~/.claude/skills/**/*/SKILL.md` | `~/.claude/skills` | `**/*/SKILL.md` |
| `~/.claude/history.jsonl` | `~/.claude` | `history.jsonl` |

## sourceCommand

標準出力をデータソースとして使用するシェルコマンド：

```yaml
sourceCommand: "ghq list"            # 各行が1アイテムになる
runCommand: "open -a {args.open} ~/ghq/{line}"
args:
  open: iTerm
```

- 出力フォーマット: プレーンテキスト（1行1アイテム）またはJSONL（1行1JSON）
- 出力の最初の行から自動判別

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
| `{args.key}` | `args`フィールドの値 | `{args.open}` |

**フォールバック:** `{frontmatter@description}|{heading}` — 左側が空の場合、右側を使用。

## プラグインパスの上書き（settings.yaml）

`settings.yaml` でプラグインパスに上書きを含めることができます：

```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/custom-search/agents@agent         # @agentでsearchPrefixを上書き
    - path/custom-search/ghq@ghq?open=iTerm     # ?open=iTermでargs.openを上書き
```

### 構文

```
<path>[@searchPrefix][?key=value&key2=value2]
```

- パスの後の `@suffix` → `searchPrefix` を設定/上書き
- パスの後の `?params` → `args` フィールドを設定/上書き

## インストール

```bash
# GitHubから
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins

# 特定のブランチ/タグ/コミット
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins@develop

# ローカルパス
prompt-line-plugin install ./my-plugins
prompt-line-plugin install ~/my-plugins
```

## ホットリロード

プラグインYAMLファイルはchokidar（300msデバウンス）で監視されます。変更はアプリ再起動なしで自動検出されます。

## リポジトリ構造

```
prompt-line-plugins/
  claude/
    agent-built-in/en.yaml          # Claude Code 組み込み（英語）
    agent-built-in/ja.yaml          # Claude Code 組み込み（日本語）
    agent-skills/commands.yaml      # ~/.claude/commands/*.md
    agent-skills/plugin-commands.yaml
    agent-skills/plugin-skills.yaml
    agent-skills/skills.yaml        # ~/.claude/skills/**/SKILL.md
    custom-search/agents.yaml       # @agent: 検索
    custom-search/history.yaml      # @r: Claude 履歴
    custom-search/plans.yaml        # @plan: 検索
    custom-search/plugin-agents.yaml
    custom-search/teams.yaml        # @team: 検索
  codex/
    agent-built-in/en.yaml          # Codex CLI 組み込み
  gemini/
    agent-built-in/en.yaml          # Gemini CLI 組み込み
  path/
    custom-search/ghq.yaml          # @ghq: リポジトリ検索
  skills/
    agent-skills/skills.yaml        # ~/.agents/skills/**/SKILL.md
```
