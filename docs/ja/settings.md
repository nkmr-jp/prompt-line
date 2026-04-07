# 設定リファレンス

Prompt Line 設定ファイル: `~/.prompt-line/settings.yaml`

設定はホットリロード対応（300msデバウンス）で、再起動不要で反映されます。

## ショートカット

2つのフォーマットに対応。アプリが自動判別します。

### 旧フォーマット（アクション → キー）
```yaml
shortcuts:
  main: Cmd+Shift+Space
  paste: Cmd+Enter
  close: Escape
  historyNext: Ctrl+j
  historyPrev: Ctrl+k
  search: Cmd+f
```

### 新フォーマット（キー → アクション）
```yaml
shortcuts:
  Cmd+Shift+Space: main    # 入力ウィンドウの表示/非表示（グローバル）
  Cmd+Enter: paste          # テキストを貼り付けてウィンドウを閉じる
  Escape: close             # 貼り付けずにウィンドウを閉じる
  Ctrl+j: historyNext       # 次の履歴項目へ移動
  Ctrl+k: historyPrev       # 前の履歴項目へ移動
  Cmd+f: search             # 履歴の検索モードを有効化
  # カスタムアクション
  Ctrl+m: "input=@md:"      # 入力欄に @md: を挿入
  Ctrl+g: "input=@ghq:"     # 入力欄に @ghq: を挿入
```

**組み込みアクション:** `main`, `paste`, `close`, `historyNext`, `historyPrev`, `search`

**カスタムアクション:** `input=<テキスト>` — 入力欄にテキストを挿入して検索をトリガー。

**使用可能な修飾キー:** `Cmd`, `Ctrl`, `Alt`, `Shift`

## ウィンドウ

```yaml
window:
  position: active-text-field   # active-text-field | active-window-center | cursor | center
  width: 640                    # 推奨: 400-800 ピクセル
  height: 320                   # 推奨: 200-400 ピクセル
```

## プラグイン

プラグインはエージェントスキル（`/`）、カスタム検索（`@prefix:`）、エージェント組み込みコマンドを提供します。

```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-built-in/en                  # Claude Code 組み込みコマンド | lang: en,ja
    - claude/agent-skills/commands              # sourcePath: ~/.claude/commands/*.md
    - claude/agent-skills/plugin-commands       # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/commands/*.md
    - claude/agent-skills/plugin-skills         # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/SKILL.md
    - claude/agent-skills/skills                # sourcePath: ~/.claude/skills/**/SKILL.md
    - claude/custom-search/agents@agent         # sourcePath: ~/.claude/agents/*.md
    - claude/custom-search/plans@plan           # sourcePath: ~/.claude/plans/*.md
    - claude/custom-search/plugin-agents@agent  # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/agents/*.md
    - claude/custom-search/teams@team           # sourcePath: ~/.claude/teams/**/config.json
    - claude/custom-search/history@r            # sourcePath: ~/.claude/history.jsonl
    # - codex/agent-built-in/en                 # Codex CLI 組み込みコマンド
    # - gemini/agent-built-in/en                # Gemini CLI 組み込みコマンド
    # - path/custom-search/ghq@ghq?open=iTerm   # sourceCommand: ghq list
```

### プラグインパス構文

```
<package>/<type>/<name>[@searchPrefix][?key=value&key2=value2]
```

- `@suffix` — プラグインYAMLの `searchPrefix` を上書き
- `?key=val` — プラグインYAMLの `args` を上書き（例: `?open=iTerm`）

### プラグインタイプ

| ディレクトリ | タイプ | トリガー |
|-----------|------|---------|
| `agent-built-in/` | エージェント組み込みコマンド | `/` |
| `agent-skills/` | ファイルからのエージェントスキル | `/` |
| `custom-search/` | カスタム検索 | `@prefix:` |

### プラグインのインストール

```bash
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
prompt-line-plugin install github.com/user/repo@branch   # 特定のブランチ/タグ
prompt-line-plugin install ./local/path                   # ローカルパス
```

## カスタム検索（インライン）

設定でカスタム検索エントリを直接定義（プラグインの代替手段）：

```yaml
customSearch:
  # ファイルベースのソース
  - name: "{line}"
    icon: folder
    color: lime
    description: ""
    sourcePath: "~/.prompt-line/z.txt"
    searchPrefix: z
    shortcut: Ctrl+]
    inputFormat: "{line}"
    maxSuggestions: 100

  # コマンドベースのソース
  - name: "{line}"
    icon: repo
    color: rose
    description: ""
    searchPrefix: ghq
    sourceCommand: "ghq list"
    shortcut: Ctrl+g
    runCommand: "open -a iTerm ~/ghq/{line}"
    sourcePath: ""
    inputFormat: "~/ghq/{line}"
    maxSuggestions: 100

  # JSONLソース
  - name: "{json@display}"
    icon: history
    color: orange
    description: ""
    searchPrefix: r
    shortcut: Ctrl+r
    sourcePath: "~/.claude/history.jsonl"
    orderBy: "{json@timestamp} desc"
    inputFormat: "{json@display}"
    displayTime: "{json@timestamp}"
    maxSuggestions: 100
```

### エントリフィールド

| フィールド | 説明 |
|-------|-------------|
| `name` | 表示名テンプレート |
| `description` | 説明テンプレート（`\|` フォールバック対応） |
| `sourcePath` | glob 付きソースパス（例: `~/.claude/commands/*.md`） |
| `sourceCommand` | データソース用シェルコマンド（sourcePathの代替） |
| `runCommand` | Ctrl+Enter で実行するシェルコマンド |
| `args` | テンプレート引数（例: `{ open: "iTerm" }` → `{args.open}`） |
| `searchPrefix` | トリガープレフィックス（例: `agent` → `@agent:`） |
| `shortcut` | 検索を有効化するキーボードショートカット |
| `icon` | Codicon アイコン名 |
| `color` | バッジカラー（名前または16進数） |
| `label` | UI バッジラベル |
| `orderBy` | ソート順（例: `{updatedAt} desc`） |
| `displayTime` | タイムスタンプ表示テンプレート |
| `inputFormat` | 挿入フォーマット（`name` またはテンプレート） |
| `maxSuggestions` | 表示する最大サジェスト数 |
| `values` | テンプレート変数パターン |
| `triggers` | トリガー文字（デフォルト: `["/"]`） |
| `excludeMarker` | このファイルを含むディレクトリをスキップ |

### テンプレート変数

| 変数 | 説明 |
|----------|-------------|
| `{basename}` | 拡張子なしファイル名 |
| `{frontmatter@field}` | YAML フロントマターフィールド |
| `{json@field}` | JSON フィールド値 |
| `{json:N@field}` | N番目の親の JSON フィールド |
| `{heading}` | 最初のマークダウン見出し |
| `{line}` | プレーンテキストファイルの各行 |
| `{content}` | ファイル全体の内容 |
| `{filepath}` | 絶対ファイルパス |
| `{dirname}` | 親ディレクトリ名 |
| `{dirname:N}` | N階層上のディレクトリ |
| `{pathdir:N}` | ベースパスからN番目のディレクトリ |
| `{latest}` | 最新の更新ディレクトリ |
| `{args.key}` | `args` フィールドの値 |

フォールバック構文: `{frontmatter@description}|{heading}` — 左側が空の場合、右側を使用。

## ファイル検索

```yaml
fileSearch:
  respectGitignore: true
  includeHidden: true
  maxFiles: 100000
  maxDepth: null
  maxSuggestions: 50
  followSymlinks: false
  includePatterns: []
  excludePatterns: []
```

## シンボル検索

```yaml
symbolSearch:
  respectGitignore: true
  maxSymbols: 200000
  timeout: 60000
  includePatterns: []
  excludePatterns: []
```

## ファイルオープナー

```yaml
fileOpener:
  defaultEditor: null             # null = システムデフォルト
  extensions:
    png: "Preview"
    pdf: "Preview"
  directories:
    - path: "~/ghq/github.com/my-org/my-go*"
      editor: "GoLand"
```

優先順位: `extensions` > `directories` > `defaultEditor` > システムデフォルト。
