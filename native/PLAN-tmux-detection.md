# tmux/screen対応 ディレクトリ検出アーキテクチャ改善プラン

## 問題の本質

現在のアーキテクチャはプロセスの親子関係に依存している：
- Electron IDE: `pty-host` → shell の親子関係を探索
- JetBrains: IDE → shell の親子関係を探索
- Terminal/Ghostty: アプリ → shell の親子関係を探索

**問題**: tmux/screen/zellijを使用すると、シェルはマルチプレクササーバーの子プロセスになり、IDE/ターミナルのプロセスツリー外になる。

```
現在のプロセスツリー:
IDE (VSCode等)
└── pty-host
    └── tmux client (←ここまでは検出可能)

tmux server (IDEとは無関係のプロセス)
└── zsh/bash (←ここが検出したいシェル)
```

## 解決策: tmux API直接使用

### 重要な発見

tmuxは `pane_current_path` で直接CWDを取得できる：
```bash
$ tmux list-panes -a -F "#{pane_pid} #{pane_current_path} #{pane_active} #{pane_tty}"
pid=27514 path=/Users/nkmr/ghq/github.com/example session=0 active=1 tty=/dev/ttys016
```

**プロセスツリーを辿る必要がない！**

## 新アーキテクチャ

### Phase 1: 現在のプロセスツリーベース検出
既存のロジックをそのまま維持（高速で多くのケースで動作）

### Phase 2: マルチプレクサフォールバック
プロセスツリーで見つからない場合、tmux APIを使用

```
検出フロー:
1. プロセスツリー探索 (既存ロジック)
   ↓ 見つからない場合
2. tmux検出 (新規)
   - tmux list-panes でアクティブペインのCWDを取得
   ↓ tmuxが動作していない場合
3. screen検出 (新規・オプション)
   - screen -Q windows でセッション情報取得
```

## 実装計画

### 1. 新規ファイル作成: `MultiplexerDetector.swift`

```swift
// MARK: - Terminal Multiplexer Detection

extension DirectoryDetector {

    // MARK: - tmux Detection

    /// Detect directory from tmux using tmux API directly
    /// This works regardless of which terminal/IDE started tmux
    static func getTmuxDirectory() -> (directory: String?, shellPid: pid_t?, method: String?) {
        // Check if tmux is running
        let checkProcess = Process()
        checkProcess.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        checkProcess.arguments = ["tmux"]
        // ... (tmuxの存在確認)

        // Get all panes with their info
        // tmux list-panes -a -F "#{pane_pid}|#{pane_current_path}|#{pane_active}|#{pane_tty}|#{pane_last_activity}"
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/tmux")
        // または /usr/local/bin/tmux をフォールバック
        process.arguments = ["list-panes", "-a", "-F",
            "#{pane_pid}|#{pane_current_path}|#{pane_active}|#{pane_tty}"]

        // パース処理
        // 1. アクティブなペイン (pane_active=1) を優先
        // 2. ホームディレクトリ以外を優先
        // 3. TTY更新時間が最新のものを優先
    }

    /// Check if tmux is available and has active sessions
    static func isTmuxAvailable() -> Bool {
        // tmux ls の実行結果でセッションの有無を確認
    }
}
```

### 2. 既存コードの修正

#### `ProcessTree.swift`
- `getTmuxTerminalDirectory()` を削除（新しいアプローチに置き換え）
- `getElectronIDETerminalDirectoryFallback()` のtmux検出部分を更新

#### `DirectoryDetector.swift`
- メイン検出ロジックにtmuxフォールバックを追加

```swift
// 既存の検出が失敗した場合
if result["error"] != nil {
    // Try tmux detection as last resort
    let (tmuxDir, tmuxPid, tmuxMethod) = getTmuxDirectory()
    if let dir = tmuxDir {
        return [
            "success": true,
            "directory": dir,
            "appName": appName,
            "bundleId": bundleId,
            "method": tmuxMethod ?? "tmux",
            "pid": tmuxPid
        ]
    }
}
```

### 3. 検出優先順位

| 優先度 | 方法 | 対象アプリ | 条件 |
|--------|------|------------|------|
| 1 | プロセスツリー (pty-host) | Electron IDE | pty-hostの子シェル |
| 2 | プロセスツリー (直接子) | JetBrains, Ghostty | IDEの子シェル |
| 3 | AppleScript + TTY | Terminal.app, iTerm2 | tty経由 |
| 4 | **tmux API (新規)** | 全アプリ | tmuxセッション内 |
| 5 | screen API (将来) | 全アプリ | screenセッション内 |

### 4. tmux検出の詳細ロジック

```swift
struct TmuxPane {
    let pid: pid_t
    let currentPath: String
    let isActive: Bool
    let tty: String
}

static func getTmuxDirectory() -> (directory: String?, shellPid: pid_t?, method: String?) {
    // 1. tmuxコマンドのパスを探す
    let tmuxPath = findTmuxPath() // /opt/homebrew/bin/tmux or /usr/local/bin/tmux

    // 2. list-panes でペイン情報を取得
    let panes = getTmuxPanes(tmuxPath: tmuxPath)

    // 3. 優先順位でソート
    //    - アクティブなペインを優先
    //    - ホームディレクトリ以外を優先
    let sortedPanes = panes.sorted { a, b in
        if a.isActive != b.isActive { return a.isActive }
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        let aIsHome = a.currentPath == homeDir
        let bIsHome = b.currentPath == homeDir
        if aIsHome != bIsHome { return !aIsHome }
        return false
    }

    // 4. 最適なペインのCWDを返す
    if let best = sortedPanes.first, best.currentPath != homeDir {
        return (best.currentPath, best.pid, "tmux-api")
    }

    return (nil, nil, nil)
}
```

## テスト計画

### ユニットテスト
1. `MultiplexerDetector.swift` のtmux API呼び出しテスト
2. ペイン情報のパーステスト
3. 優先順位ソートのテスト

### 統合テスト（手動）
| シナリオ | 期待結果 |
|----------|----------|
| VSCode + tmux内でzsh | プロジェクトディレクトリ検出 |
| Ghostty + tmux内でzsh | プロジェクトディレクトリ検出 |
| iTerm2 + tmux内でzsh | プロジェクトディレクトリ検出 |
| Cursor + tmux内でzsh | プロジェクトディレクトリ検出 |
| 複数tmuxセッション | アクティブセッションのCWD |

## 実装手順

1. **Phase 1**: `MultiplexerDetector.swift` 新規作成
   - `getTmuxDirectory()` 実装
   - `isTmuxAvailable()` 実装
   - `findTmuxPath()` 実装

2. **Phase 2**: 既存コードへの統合
   - `DirectoryDetector.swift` にフォールバック追加
   - `ProcessTree.swift` から古いtmux検出を削除

3. **Phase 3**: テストとドキュメント
   - 手動テスト実施
   - CLAUDE.md 更新

## リスクと考慮事項

1. **tmuxのパス**: macOSではHomebrew (`/opt/homebrew/bin/tmux`) または手動インストール (`/usr/local/bin/tmux`)
2. **パフォーマンス**: tmux API呼び出しは数十msかかる可能性（フォールバックなので許容）
3. **複数セッション**: 複数のtmuxセッションがある場合、アクティブなペインを正しく選択する必要がある
4. **screen/zellij**: 将来的にサポートを追加する場合の拡張性を考慮

## 決定事項

1. **サポート範囲**: tmuxのみサポート（screen/zellijは対象外）
2. **優先順位**: アクティブペイン優先（最も直感的なアプローチ）

## 実装サマリー

### 変更ファイル
1. `native/directory-detector/MultiplexerDetector.swift` (新規)
2. `native/directory-detector/DirectoryDetector.swift` (修正)
3. `native/directory-detector/ProcessTree.swift` (修正)
4. `native/CLAUDE.md` (ドキュメント更新)
