# プラグイン作成ガイド

プラグインはYAMLファイルで、Prompt Lineにエージェントスキル（`/`）、カスタム検索（`@prefix:`）、エージェント組み込みコマンドを追加します。

## クイックスタート

最も簡単な方法は、ローカルディレクトリにYAMLファイルを配置することです。GitHubリポジトリは不要です。

### エージェントスキルを追加

`~/.prompt-line/agent-skills/my-commands.yaml` を作成：
```yaml
sourcePath: ~/my-project/commands/*.md
name: "{basename}"
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
```

入力欄で `/` を入力するとコマンドが表示されます。

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
| `agent-skills/` | エージェントスキル | `/` | マークダウンファイルからスキルを読み込み |
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

マークダウンファイルからスキルを読み込みます。各YAMLは `.md` ファイルのディレクトリに対応します。

```yaml
sourcePath: ~/.claude/commands/*.md
name: "{basename}"
label: global
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
```

### フィールド

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `sourcePath` | Yes* | ソースファイルへのglobパス |
| `sourceCommand` | Yes* | データソース用シェルコマンド（sourcePathの代替） |
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

\* `sourcePath` または `sourceCommand` のいずれかが必須。

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
sourcePath: ""
name: "{line}"
searchPrefix: ghq
runCommand: "open -a iTerm ~/ghq/{line}"
inputFormat: "~/ghq/{line}"
```

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
sourcePath: ~/.claude/commands/*.md           # シンプルなglob
sourcePath: ~/.claude/skills/**/*/SKILL.md    # 再帰glob
sourcePath: ~/.claude/history.jsonl            # 特定ファイル
sourcePath: "~/.claude/teams/**/config.json@. | select(.active)"  # JSON + jq
```

### 分割ルール

`sourcePath` は最初のglob文字（`*`, `?`, `[`）でディレクトリ + パターンに分割されます：

| sourcePath | ディレクトリ | パターン |
|-----------|-----------|---------|
| `~/.claude/commands/*.md` | `~/.claude/commands` | `*.md` |
| `~/.claude/skills/**/*/SKILL.md` | `~/.claude/skills` | `**/*/SKILL.md` |

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
    agent-skills/commands.yaml
    custom-search/search.yaml
```

### インストール

```bash
prompt-line-plugin install github.com/user/my-plugins
prompt-line-plugin install github.com/user/my-plugins@v1.0.0   # バージョン指定
```

### settings.yaml で有効化

```yaml
plugins:
  github.com/user/my-plugins:
    - my-tool/agent-built-in/en
    - my-tool/agent-skills/commands
    - my-tool/custom-search/search@prefix    # @prefixでsearchPrefixを上書き
```

### パスの上書き

```
<path>[@searchPrefix][?key=value&key2=value2]
```

- `@suffix` → `searchPrefix` を上書き
- `?key=val` → `args` を上書き（例: `?open=iTerm`）

---

## ホットリロード

すべてのYAMLファイルはchokidar（300msデバウンス）で監視されます。アプリ再起動なしで変更が自動検出されます。ローカルディレクトリとプラグインディレクトリの両方が対象です。
