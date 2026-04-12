# 設定マイグレーションガイド

`~/.prompt-line/settings.yaml` のバージョン間の変更点をまとめたガイドです。

## 自動マイグレーション

マイグレーションコマンドを実行すると、既存設定をバックアップして最新のデフォルトに置き換えます：

```bash
pnpm run migrate-settings
```

実行内容：
1. `~/.prompt-line/settings.yaml` → `settings.backup.<タイムスタンプ>.yaml` にバックアップ
2. 最新のデフォルト設定（`settings.example.yaml` と同じ）で置き換え

バックアップは保持されるので、カスタマイズを再適用する際に参照できます。

---

## v0.32 → v0.33

### 1. テンプレート変数 `{updatedAt}` を `{mtime}` にリネーム

テンプレート変数 `{updatedAt}` は、他の小文字テンプレート変数（`{basename}`, `{heading}`, `{filepath}` 等）との一貫性のため `{mtime}` にリネームされました。

`settings.yaml` のカスタム検索エントリで `{updatedAt}` を使用している場合は更新してください：

**変更前:**
```yaml
orderBy: "{updatedAt} desc"
displayTime: "{updatedAt}"
```

**変更後:**
```yaml
orderBy: "{mtime} desc"
displayTime: "{mtime}"
```

カスタムプラグインYAMLファイルで `{updatedAt}` を参照している場合も同様に更新してください。

---

## v0.29 → v0.30

### 1. ショートカットフォーマットの変更（キー → アクション）

ショートカットセクションが **アクション → キー** 形式から **キー → アクション** 形式に変更されました。

**変更前:**
```yaml
shortcuts:
  main: Cmd+Shift+Space
  paste: Cmd+Enter
  close: Escape
  historyNext: Ctrl+j
  historyPrev: Ctrl+k
  search: Cmd+f
```

**変更後:**
```yaml
shortcuts:
  Cmd+Shift+Space: main    # 入力ウィンドウの表示/非表示（グローバル）
  Cmd+Enter: paste          # テキストを貼り付けてウィンドウを閉じる
  Escape: close             # 貼り付けずにウィンドウを閉じる
  Ctrl+j: historyNext       # 次の履歴項目へ移動
  Ctrl+k: historyPrev       # 前の履歴項目へ移動
  Cmd+f: search             # 履歴の検索モードを有効化
  # Ctrl+m: "input=@md:"   # カスタムアクション
  # Ctrl+g: "input=@ghq:"
```

**対応:** 不要。両方のフォーマットが自動検出され、サポートされます。新フォーマットは `input=@md:` のような**カスタムアクション**もサポートするため推奨です。

---

### 2. セクション順序の変更

設定ファイルのセクション順序が整理されました。

**変更前:** shortcuts → window → fileOpener → plugins → agentBuiltIn → agentSkills → customSearch → fileSearch → symbolSearch

**変更後:** window → shortcuts → plugins → fileOpener → fileSearch → symbolSearch → customSearch

**対応:** 不要。セクション順序は動作に影響しません。

---

### 3. `fileSearch.maxFiles` のデフォルト値増加

| 設定 | 変更前 | 変更後 |
|------|--------|--------|
| `fileSearch.maxFiles` | 5000 | 100000 |

**対応:** 不要。`maxFiles: 5000` を明示的に設定していた場合、大規模プロジェクトでのファイル検索を改善するために値を増やすことを検討してください。

---

### 4. `symbolSearch.respectGitignore` の追加

シンボル検索で `.gitignore` を尊重する新しい設定が追加されました。

```yaml
symbolSearch:
  respectGitignore: true   # 新規（デフォルト: true）
  maxSymbols: 200000
  timeout: 60000
```

**対応:** 不要。デフォルトは `true` で、従来の動作と同じです。

---

### 5. 非推奨セクションのデフォルト出力を廃止

以下のセクションは、データが空の場合に設定ファイルに表示されなくなりました：

- `agentBuiltIn` — 代わりに `plugins` を使用
- `agentSkills` — 代わりに `plugins` を使用

これらのセクションにアクティブなエントリがある場合は、引き続き表示され動作します。

**移行方法:** `plugins` フォーマットに移行してください。

**変更前 (agentBuiltIn):**
```yaml
agentBuiltIn:
  - claude
```

**変更後 (plugins):**
```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-built-in/en
```

**変更前 (agentSkills):**
```yaml
agentSkills:
  - name: "{basename}"
    description: "{frontmatter@description}"
    sourcePath: ~/.claude/commands/*.md
```

**変更後 (plugins):**
```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-skills/commands    # sourcePath: ~/.claude/commands/*.md
```

---

### 6. `customSearch` セクションの非推奨化

settings.yaml のインライン `customSearch` セクションは、`agentBuiltIn` や `agentSkills` と同様に非推奨になりました。アクティブなエントリがある場合のみ設定ファイルに表示されます。

**移行方法:** プラグインまたはローカルYAMLファイルを使用してください（項目7参照）。

旧 `path`/`pattern` フィールドを使用したインラインエントリがある場合、`sourcePath` に統合してください：

**変更前:**
```yaml
customSearch:
  - name: "{basename}"
    path: ~/.claude/agents
    pattern: "*.md"
    searchPrefix: agent
```

**変更後（プラグインYAMLまたはローカルYAML）:**
```yaml
sourcePath: ~/.claude/agents/*.md
name: "{basename}"
searchPrefix: agent
```

---

### 7. ローカルYAMLディレクトリ（プラグイン不要）

プラグインを作成せずに、`~/.prompt-line/` のサブディレクトリにYAML設定ファイルを直接配置できます：

```
~/.prompt-line/
  agent-built-in/     # エージェント組み込みエージェントスキル (*.yaml)
  agent-skills/       # マークダウンファイルからのエージェントスキル (*.yaml)
  custom-search/      # カスタム検索エントリ (*.yaml)
```

これらのディレクトリは自動的に作成され、変更が監視されます（ホットリロード）。

**例:** `~/.prompt-line/custom-search/my-notes.yaml` を作成：
```yaml
sourcePath: ~/notes/**/*.md
name: "{basename}"
description: "{heading}"
searchPrefix: note
shortcut: Ctrl+n
```

これはプラグインと同等ですが、個人設定にはよりシンプルです。

**対応:** 不要。プラグインと併用できる追加オプションです。

---

## クイックリファレンス: 新フォーマット全体

完全な設定リファレンスは [settings.md](settings.md) を参照してください。
