# Windows 移植ガイド

このドキュメントは、Prompt Line アプリケーションを macOS から Windows に移植するための調査結果と実装ガイドです。

## 概要

Prompt Line は主に Electron で構築されており、Mac ネイティブ部分は限定的です。以下の戦略で Windows 移植を進めます：

1. Mac ネイティブ部分を特定し切り離す
2. ビルドが通るように修正
3. Windows 版のネイティブ機能を実装

## Mac ネイティブコンポーネント

### 1. Swift ネイティブツール（`native/` ディレクトリ）

#### keyboard-simulator.swift
- **機能**: キーボードイベント（Cmd+V）のシミュレーション、アプリケーションのアクティベーション
- **Windows 対応**: Win32 API または .NET を使用して Ctrl+V シミュレーションを実装

#### window-detector.swift
- **機能**: アクティブウィンドウの位置・サイズ検出、アプリケーション情報の取得
- **Windows 対応**: Win32 API の `GetForegroundWindow()` と `GetWindowRect()` を使用

#### text-field-detector.swift
- **機能**: フォーカスされているテキストフィールドの検出と位置情報の取得
- **Windows 対応**: UI Automation API または Active Accessibility を使用

### 2. ビルドシステム

- **Makefile**: Swift コンパイラ設定
- **Windows 対応**: PowerShell スクリプトでのビルド設定

## プラットフォーム依存コード

### 1. プラットフォームチェック箇所

| ファイル | 内容 | Windows 対応 |
|---------|------|-------------|
| `src/main.ts` | `process.platform === 'darwin'` チェック | `=== 'win32'` に変更 |
| `src/main.ts` | `app.dock.hide()` | Windows では不要（削除） |
| `src/config/app-config.ts` | `isMac` プロパティ | `isWindows` プロパティを追加 |

### 2. ネイティブツール呼び出し

| ファイル | 機能 | Windows 対応 |
|---------|------|-------------|
| `src/utils/utils.ts` | `getCurrentApp()` | Windows API で再実装 |
| `src/utils/utils.ts` | `getActiveWindowBounds()` | Win32 API 使用 |
| `src/utils/utils.ts` | `pasteWithNativeTool()` | SendInput API 使用 |
| `src/utils/utils.ts` | `activateAndPasteWithNativeTool()` | SetForegroundWindow + SendInput |
| `src/utils/utils.ts` | `getActiveTextFieldBounds()` | UI Automation API 使用 |

### 3. AppleScript 関連

| ファイル | 用途 | Windows 対応 |
|---------|------|-------------|
| `src/utils/apple-script-sanitizer.ts` | AppleScript 実行 | ✅ プラットフォーム抽象化により分離済み |
| `src/utils/utils.ts` | アクセシビリティ権限チェック | ✅ Windows では不要（`return true`で対応） |
| `src/managers/desktop-space-manager.ts` | デスクトップスペース検出 | 仮想デスクトップ API 使用 |

### 4. ファイルパス

| 現在 | Windows 版 |
|------|------------|
| `~/.prompt-line/` | `%APPDATA%\prompt-line\` |
| `/` パス区切り | `\` または `path.join()` 使用 |

### 5. キーボードショートカット

| Mac | Windows |
|-----|---------|
| Cmd+V | Ctrl+V |
| Cmd+Enter | Ctrl+Enter |
| Cmd+Shift+V | Ctrl+Shift+V |

### 6. システムトレイ

- `setTemplateImage(true)` は Windows では不要
- Windows 用のトレイアイコン設定に変更

## Windows 実装優先順位

### Phase 1: 基本ビルド（ネイティブ機能なし）
1. プラットフォームチェックの修正
2. Mac 専用 API の条件分岐
3. ファイルパスの修正
4. 基本的な Electron アプリとしてビルド

### Phase 2: コア機能の実装
1. **window-detector**: アクティブウィンドウ検出（Win32 API）
2. **keyboard-simulator**: Ctrl+V シミュレーション（SendInput API）
3. グローバルショートカットの調整

### Phase 3: 高度な機能
1. **text-field-detector**: テキストフィールド検出（UI Automation）
2. アプリケーション切り替え機能
3. 仮想デスクトップ対応

## Windows ネイティブツール実装案

### 技術選択肢

1. **C++ with Win32 API**
   - 利点: 高速、直接的な API アクセス
   - 欠点: 開発が複雑

2. **C# with .NET プロセス実行** ⭐ **採用**
   - 利点: 開発が容易、豊富なライブラリ、Mac版との構造統一
   - 欠点: .NET ランタイムが必要

3. **Node.js ネイティブモジュール**
   - 利点: JavaScript との統合が容易
   - 欠点: ビルドが複雑

### 採用した実装アプローチ

**C# 実行ファイル + プロセス実行**

Mac版と同じアーキテクチャを採用。標準入出力でJSONをやり取りし、FFIの複雑性を回避。

```csharp
// window-detector/WindowDetector.cs の例
static void Main(string[] args)
{
    switch (args[0])
    {
        case "current-app":
            GetCurrentApp();
            break;
        case "window-bounds":
            GetActiveWindowBounds();
            break;
    }
}

private static void GetCurrentApp()
{
    var hWnd = GetForegroundWindow();
    GetWindowThreadProcessId(hWnd, out uint processId);
    var processName = GetProcessName(processId);
    
    var result = new { name = processName, bundleId = (string?)null };
    Console.WriteLine(JsonSerializer.Serialize(result));
}
```

```typescript
// Node.js側（プロセス実行）
exec(`"${WINDOW_DETECTOR_PATH}" current-app`, options, (error, stdout) => {
  if (error) {
    resolve(null);
    return;
  }
  
  try {
    const result = JSON.parse(stdout.trim());
    resolve(result);
  } catch (parseError) {
    resolve(null);
  }
});
```

## 移植作業進捗チェックリスト

### Phase 1: 基本移植作業 ✅
- [x] プロジェクトのフォーク/ブランチ作成
- [x] Mac ネイティブ部分の特定と調査
- [x] プラットフォーム抽象化レイヤーの設計・実装
- [x] プラットフォーム条件分岐の実装 (main.ts, ipc-handlers.ts, window-manager.ts)
- [x] Mac 専用 API の条件分岐 (app.dock.hide, setTemplateImage)
- [x] TypeScript 型エラーの修正

### Phase 2: ビルドシステム対応 ✅
- [x] クロスプラットフォームビルドスクリプトの作成
- [x] Windows 向け electron-builder 設定の追加
- [x] 基本ビルドの確認（ネイティブ機能なし）
- [x] Windows アイコンファイルの作成（プレースホルダー）
- [x] ファイル操作スクリプトの作成 (copy-renderer-files.js, clean.js)

### Phase 3: Windows ネイティブツール実装 ✅
- [x] C# 実行ファイル + プロセス実行アーキテクチャの設計・実装
- [x] window-detector の Windows 実装 (C# + Win32 API)
- [x] keyboard-simulator の Windows 実装 (SendInput API)
- [x] text-field-detector の Windows 実装 (UI Automation)
- [x] Mac版との統一アーキテクチャ実装
- [x] PowerShell ビルドスクリプト
- [x] キーボードショートカットの調整 (Cmd→Ctrl)
- [x] Windows GPU設定の追加

### Phase 4: 高度な機能 ⏳
- [ ] 仮想デスクトップ対応 (desktop-space-manager)
- [ ] AppleScript 代替実装 (PowerShell/WSH)
- [ ] システムトレイの Windows 対応
- [ ] アプリケーション切り替え機能の実装

### Phase 5: テスト・パッケージング ⏳
- [ ] Windows 開発環境のセットアップ
- [ ] テストの作成/修正
- [ ] Windows でのビルド確認
- [ ] パッケージング設定 (NSIS インストーラー)
- [ ] インストーラーの作成とテスト

### Phase 6: 品質保証 ⏳
- [ ] Windows 10/11 での動作確認
- [ ] アンチウイルスソフトでの検証
- [ ] パフォーマンステスト
- [ ] ドキュメントの更新

## 現在の状況

**完了済み (Phase 1-3 完了):**
- プラットフォーム抽象化レイヤー (`src/platform/`) を実装済み
- Mac 専用コードをプラットフォーム依存部分として分離
- TypeScript ビルドエラーを全て解決
- クロスプラットフォームビルドスクリプトを作成・テスト済み
- Windows 向け electron-builder 設定を追加
- 基本ビルドが Windows 環境で動作することを確認
- **C# プロセス実行アーキテクチャを実装**
- **3つの独立したWindows native tools完了**
- **Mac版との統一アーキテクチャ完了**
- **Windows GPU設定とキーボードショートカット修正完了**

**実装済みのファイル:**
- `scripts/compile-platform.js` - プラットフォーム検出とビルド振り分け
- `scripts/copy-renderer-files.js` - クロスプラットフォームファイルコピー
- `scripts/clean.js` - クロスプラットフォームクリーンアップ
- `src/platform/` - プラットフォーム抽象化レイヤー
- `native-win/` - Windows C# プロジェクト群
  - `window-detector/` - C# プロジェクト（ウィンドウ検出）
  - `keyboard-simulator/` - C# プロジェクト（キーボード操作）
  - `text-field-detector/` - C# プロジェクト（テキストフィールド検出）
  - `build-all.ps1` - PowerShell 統合ビルドスクリプト
  - `README.md` - Windows実装ドキュメント
- `assets/Prompt-Line.ico` - Windows アイコン（プレースホルダー）
- `package.json` - 更新済み（Windows ビルド設定、FFI依存削除）

**次のステップ (Phase 4):**
- 仮想デスクトップ対応
- システムトレイの完全な Windows 対応
- 統合テストとデバッグ

## 注意事項

1. **セキュリティ**: C# コンパイル済み実行ファイルによりスクリプトインジェクションを防ぐ
2. **権限**: Windows では UAC や管理者権限は不要（キーボードフックを使わない限り）
3. **アンチウイルス**: キーボードシミュレーションはアンチウイルスソフトに検出される可能性があるため、デジタル署名が重要
4. **互換性**: Windows 10/11 をターゲットとし、古いバージョンは考慮しない
5. **要件**: .NET 8.0 Runtime が必要、PowerShell 実行ポリシーの設定が必要

## 構築手順

### 前提条件
- Node.js 20 以上
- .NET 8.0 SDK（開発時）/ .NET 8.0 Runtime（実行時）
- PowerShell（Windows 標準）
- Git

### ビルド手順
```bash
# 1. リポジトリクローン
git clone https://github.com/your-repo/prompt-line.git
cd prompt-line

# 2. 依存関係インストール
npm install

# 3. ビルド
npm run compile    # 開発用
npm run build:win  # パッケージ作成用
```

### トラブルシューティング
- PowerShell 実行ポリシーエラー: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- .NET SDK エラー: https://dotnet.microsoft.com/download から .NET 8.0 SDK をダウンロード

## アーキテクチャ概要

### Mac版との統一

| 項目 | Mac版 | Windows版 |
|------|-------|-----------|
| **実装言語** | Swift | C# |
| **実行方式** | プロセス実行 | プロセス実行 |
| **通信方式** | JSON標準入出力 | JSON標準入出力 |
| **パフォーマンス** | プロセス起動オーバーヘッド有り | プロセス起動オーバーヘッド有り |
| **セキュリティ** | コンパイル済みバイナリ | コンパイル済み実行ファイル |
| **ビルド要件** | Xcode | .NET 8.0 SDK |

### 実装済みの機能

#### ✅ window-detector
- `current-app` - アクティブアプリケーション取得
- `window-bounds` - ウィンドウ位置・サイズ取得
- Win32 API（GetForegroundWindow, GetWindowRect）を使用
- JSON形式で結果を標準出力に返す

#### ✅ keyboard-simulator
- `paste` - Ctrl+V シミュレーション
- `activate-name <app>` - アプリケーションアクティベーション
- `activate-and-paste-name <app>` - 複合操作
- Win32 API（SendInput, SetForegroundWindow）を使用

#### ✅ text-field-detector
- デフォルト - フォーカス中テキストフィールド検出
- `bounds` - 同上
- UI Automation API を使用

### 技術的な選択理由

1. **C# プロセス実行**：Mac版との構造統一、FFIの複雑性回避
2. **.NET 8.0**：最新の安定版、優れた Win32 API サポート
3. **PowerShell ビルド**：Windows 標準環境でのビルド
4. **JSON通信**：構造化データ、パースエラーの最小化

### Windows ネイティブツール開発戦略

#### 採用: C# プロセス実行アプローチ

**利点:**
- Mac版との完全な統一
- FFI（ffi-napi）の複雑性回避
- 開発・デバッグの容易さ
- 型安全性とメモリ管理
- プロセス分離によるセキュリティ

**実装例:**
```csharp
// native-win/window-detector/WindowDetector.cs
static void Main(string[] args)
{
    if (args.Length == 0)
    {
        Console.WriteLine(JsonSerializer.Serialize(new { error = "No command specified" }));
        Environment.Exit(1);
    }

    switch (args[0])
    {
        case "current-app":
            GetCurrentApp();
            break;
        case "window-bounds":
            GetActiveWindowBounds();
            break;
    }
}
```

```typescript
// src/platform/windows-platform-tools.ts
exec(`"${WINDOW_DETECTOR_PATH}" current-app`, options, (error: Error | null, stdout?: string) => {
  if (error) {
    console.warn('getCurrentApp failed:', error);
    resolve(null);
    return;
  }

  try {
    const result = JSON.parse(stdout?.trim() || '{}');
    if (result.error) {
      console.warn('getCurrentApp failed:', result.error);
      resolve(null);
      return;
    }
    
    resolve({
      name: result.name,
      bundleId: result.bundleId
    });
  } catch (parseError) {
    console.warn('Error parsing getCurrentApp result:', parseError);
    resolve(null);
  }
});
```

### 実装済みファイル一覧

1. **scripts/** ✅
   - `compile-platform.js` - OS 検出とビルド振り分け ✅
   - `copy-renderer-files.js` - クロスプラットフォームファイルコピー ✅
   - `clean.js` - クロスプラットフォームクリーンアップ ✅

2. **native-win/** ✅
   - `window-detector/` - ウィンドウ検出C#プロジェクト ✅
   - `keyboard-simulator/` - キーボード操作C#プロジェクト ✅
   - `text-field-detector/` - テキストフィールド検出C#プロジェクト ✅
   - `build-all.ps1` - PowerShell 統合ビルドスクリプト ✅
   - `README.md` - Windows実装ドキュメント ✅

3. **assets/** ✅
   - `Prompt-Line.ico` - Windows アイコン（256x256, 128x128, 64x64, 32x32, 16x16）✅

## 既知の制約・問題

### ElectronアプリでのUI Automationの制限

**問題**: VSCode、Slack、Discord、TeamsなどのElectronアプリにおいて、WindowsとmacOSでUI Automationの挙動が大きく異なる

#### macOS（正常動作）
- フォーカス要素が `AXTextField` として正確に認識される
- 有効な座標値（x, y, width, height）が取得可能
- Prompt Lineが正確なテキストフィールド位置に表示される

**例（Mac版 VSCode）:**
```json
{
  "x": -2393,
  "y": 1420, 
  "width": 7,
  "height": 14,
  "role": "AXTextField",
  "appName": "Code"
}
```

#### Windows（制限あり）
- フォーカス要素が `ControlType.Document` として認識される
- BoundingRectangleが無限大値（Infinity/-Infinity）で無効
- テキストフィールドの正確な位置が取得できない

**例（Windows版 VSCode）:**
```json
{
  "controlType": "ControlType.Document",
  "bounds": {
    "x": "Infinity",
    "y": "Infinity", 
    "width": "-Infinity",
    "height": "-Infinity",
    "isEmpty": true
  },
  "hasKeyboardFocus": true,
  "appName": "Code"
}
```

#### 根本原因
1. **WebView要素の認識差異**: ElectronアプリはChromium WebViewを使用しており、WindowsのUI AutomationとmacOSのAccessibility APIでHTML要素の認識方法が根本的に異なる
2. **Document型の制限**: Windows版では実際のテキスト入力要素ではなく、WebView全体がDocument型として返される
3. **座標計算の失敗**: WebView内のHTML要素の座標をネイティブAPIで正確に取得することができない

#### 現在の対応策
- Document型が検出された場合は `null` を返す（Mac版と同じ動作）
- `active-text-field` モードでテキストフィールドが検出できない場合、自動的に `active-window-center` にフォールバック
- Electronアプリでは画面中央やや上側に表示される

#### 将来的な改善可能性
- Electron/Chromiumのアクセシビリティ実装が改善される可能性
- WebView2ベースの実装への移行により改善される可能性
- 代替手段（OCR、スクリーン解析等）の検討

この制約により、現状ではWindowsでのElectronアプリ使用時にmacOSと完全に同等の位置精度は実現できないが、基本的な機能は問題なく動作する。

## 参考リソース

- [Win32 API Documentation](https://docs.microsoft.com/en-us/windows/win32/)
- [UI Automation Overview](https://docs.microsoft.com/en-us/windows/win32/winauto/uiauto-uiautomationoverview)
- [Electron Platform-Specific Code](https://www.electronjs.org/docs/latest/tutorial/platform-integration)
- [.NET 8.0 P/Invoke Documentation](https://docs.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke)