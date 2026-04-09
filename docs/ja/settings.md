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

## ローカルYAMLディレクトリ

プラグインを作成せずに、`~/.prompt-line/` のサブディレクトリにYAML設定ファイルを直接配置できます：

```
~/.prompt-line/
  agent-built-in/     # エージェント組み込みコマンド (*.yaml)
  agent-skills/       # ファイルからのエージェントスキル (*.yaml)
  custom-search/      # カスタム検索エントリ (*.yaml)
```

これらのディレクトリは自動作成され、変更が監視されます（ホットリロード）。YAMLフォーマットはプラグインYAMLと同じです。フィールドリファレンスとテンプレート変数については [plugins.md](plugins.md) を参照してください。

**例:** `~/.prompt-line/custom-search/my-notes.yaml`
```yaml
sourcePath: ~/notes/**/*.md
name: "{basename}"
description: "{heading}"
searchPrefix: note
```

## 画像ストレージ

```yaml
imagesDirectory: .prompt-line/images
```

| フィールド | デフォルト | 説明 |
|-------|---------|-------------|
| `imagesDirectory` | （未設定） | 画像保存ディレクトリ。相対パスはCWDを基準に解決。未設定時は `~/.prompt-line/images/` |

ヒント: プロジェクト内で相対パスを使用する場合、`.gitignore` にディレクトリを追加してください。

## ファイル検索

入力欄で `@` を入力すると起動。`fd` コマンドが必要（`brew install fd`）。

```yaml
fileSearch:
  respectGitignore: true    # .gitignore を尊重（fd のみ）
  includeHidden: true       # 隠しファイルを含む（.で始まるファイル）
  maxFiles: 100000          # インデックスするファイルの最大数
  maxDepth: null            # ディレクトリ深度制限（null = 無制限）
  maxSuggestions: 50        # ポップアップに表示する最大サジェスト数
  followSymlinks: false     # シンボリックリンクをたどる
  #fdPath: null             # fd コマンドのカスタムパス
  includePatterns: []       # .gitignore でも強制的に含めるパターン（glob構文）
  excludePatterns: []       # 追加の除外パターン（glob構文）
```

| フィールド | デフォルト | 説明 |
|-------|---------|-------------|
| `respectGitignore` | `true` | `.gitignore` ルールを尊重 |
| `includeHidden` | `true` | 隠しファイル（`.`で始まる）を含む |
| `maxFiles` | `100000` | インデックスするファイルの最大数 |
| `maxDepth` | `null` | ディレクトリ深度制限（`null` = 無制限） |
| `maxSuggestions` | `50` | ポップアップに表示する最大サジェスト数 |
| `followSymlinks` | `false` | シンボリックリンクをたどる |
| `fdPath` | `null` | `fd` コマンドのカスタムパス（`null` = 自動検出） |
| `includePatterns` | `[]` | `.gitignore` でも強制的に含めるパターン（例: `["*.log", "dist/**"]`） |
| `excludePatterns` | `[]` | 追加の除外パターン（例: `["node_modules", "*.min.js"]`） |

## シンボル検索

`@lang:query` と入力すると起動（例: `@ts:Config`, `@go:Handler`）。`ripgrep` が必要（`brew install ripgrep`）。

スペース区切りのキーワードでAND検索が可能（例: `@ts:Config util`）。

```yaml
symbolSearch:
  respectGitignore: true    # .gitignore を尊重
  maxSymbols: 200000        # インデックスするシンボルの最大数
  timeout: 60000            # 検索タイムアウト（ミリ秒）
  #rgPath: null             # rg コマンドのカスタムパス
  includePatterns: []       # 強制的に含めるファイルパターン（glob構文）
  excludePatterns: []       # 追加の除外ファイルパターン（glob構文）
```

| フィールド | デフォルト | 説明 |
|-------|---------|-------------|
| `respectGitignore` | `true` | `.gitignore` ファイルを尊重 |
| `maxSymbols` | `200000` | ディレクトリあたりのインデックスするシンボルの最大数 |
| `timeout` | `60000` | 検索タイムアウト（ミリ秒） |
| `rgPath` | `null` | `rg` コマンドのカスタムパス（`null` = 自動検出） |
| `includePatterns` | `[]` | 強制的に含めるファイルパターン（例: `["*.test.ts", "vendor/**"]`） |
| `excludePatterns` | `[]` | 追加の除外ファイルパターン（例: `["*.generated.go"]`） |

## ファイルオープナー

ファイルリンク（`@path` 参照のCmd+クリック）を開くアプリケーションを設定。

```yaml
fileOpener:
  defaultEditor: null             # null = システムデフォルト（macOS "open" コマンド）
  extensions:
    png: "Preview"
    pdf: "Preview"
  directories:
    - path: "~/ghq/github.com/my-org/my-go*"
      editor: "GoLand"
```

| フィールド | デフォルト | 説明 |
|-------|---------|-------------|
| `defaultEditor` | `null` | 全ファイルのフォールバックエディタ（`null` = システムデフォルト） |
| `extensions` | `{png: Preview, pdf: Preview}` | 拡張子別アプリ（例: `ts: "WebStorm"`） |
| `directories` | `[]` | ディレクトリ別エディタ（glob対応） |

**優先順位:** `extensions` > `directories` > `defaultEditor` > システムデフォルト。

**ディレクトリglobパターン:** `path` は `~`（ホーム）、`*`（単一階層）、`**`（複数階層）に対応。最も具体的なパターン（最長の非globプレフィックス）が優先されます。
