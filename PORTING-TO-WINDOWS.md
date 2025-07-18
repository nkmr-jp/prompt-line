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
- **Windows 対応**: Visual Studio または MinGW でのビルド設定が必要

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
| `src/utils/apple-script-sanitizer.ts` | AppleScript 実行 | PowerShell または WSH に置き換え |
| `src/utils/utils.ts` | アクセシビリティ権限チェック | Windows では不要（削除） |
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

2. **C# with .NET + FFI** ⭐ **採用**
   - 利点: 開発が容易、豊富なライブラリ、プロセス起動オーバーヘッドなし
   - 欠点: .NET ランタイムが必要

3. **Node.js ネイティブモジュール**
   - 利点: JavaScript との統合が容易
   - 欠点: ビルドが複雑

### 採用した実装アプローチ

**C# DLL + FFI（Foreign Function Interface）**

Mac版はプロセス起動のオーバーヘッドがあるため、Windows版ではC# DLLを直接呼び出すFFIアプローチを採用。

```csharp
// WindowDetector.cs の例
[UnmanagedCallersOnly(EntryPoint = "GetActiveWindowBounds")]
public static IntPtr GetActiveWindowBounds()
{
    var hWnd = GetForegroundWindow();
    GetWindowRect(hWnd, out RECT rect);
    
    var bounds = new WindowBounds
    {
        X = rect.Left,
        Y = rect.Top,
        Width = rect.Right - rect.Left,
        Height = rect.Bottom - rect.Top
    };
    
    return Marshal.StringToHGlobalAnsi(JsonSerializer.Serialize(bounds));
}
```

```javascript
// Node.js側（FFI）
const ffi = require('ffi-napi');
const windowDetector = ffi.Library('WindowDetector.dll', {
    'GetActiveWindowBounds': ['pointer', []]
});

const result = windowDetector.GetActiveWindowBounds();
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

### Phase 3: Windows ネイティブツール実装 ⏳
- [x] C# DLL + FFI アーキテクチャの設計・実装
- [x] window-detector の Windows 実装 (C# + Win32 API)
- [x] FFI統合の実装 (ffi-napi + ref-napi)
- [x] .NET 8.0 + UnmanagedCallersOnly アプローチ
- [x] PowerShell ビルドスクリプト
- [x] キーボードショートカットの調整 (Cmd→Ctrl)
- [x] Windows GPU設定の追加
- [ ] keyboard-simulator の Windows 実装 (SendInput API) ⏳
- [ ] text-field-detector の Windows 実装 (UI Automation)
- [ ] Windows 版アクセシビリティ権限チェック

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

**完了済み (Phase 1-3 部分完了):**
- プラットフォーム抽象化レイヤー (`src/platform/`) を実装済み
- Mac 専用コードをプラットフォーム依存部分として分離
- TypeScript ビルドエラーを全て解決
- クロスプラットフォームビルドスクリプトを作成・テスト済み
- Windows 向け electron-builder 設定を追加
- 基本ビルドが Windows 環境で動作することを確認
- **C# DLL + FFI アーキテクチャを実装**
- **window-detector の Windows 実装完了**
- **FFI統合（ffi-napi + ref-napi）完了**
- **Windows GPU設定とキーボードショートカット修正完了**

**実装済みのファイル:**
- `scripts/compile-platform.js` - プラットフォーム検出とビルド振り分け
- `scripts/copy-renderer-files.js` - クロスプラットフォームファイルコピー
- `scripts/clean.js` - クロスプラットフォームクリーンアップ
- `scripts/build-windows-tools.js` - Windows C# DLL ビルド
- `src/platform/` - プラットフォーム抽象化レイヤー
- `native-win/` - Windows C# DLL プロジェクト
  - `WindowDetector.csproj` - .NET 8.0 プロジェクト
  - `WindowDetector.cs` - C# 実装
  - `build.ps1` - PowerShell ビルドスクリプト
- `assets/Prompt-Line.ico` - Windows アイコン（プレースホルダー）
- `package.json` - 更新済み（ffi-napi対応、Windows ビルド設定）

**次のステップ (Phase 3 継続):**
- keyboard-simulator の Windows 実装 (SendInput API)
- text-field-detector の Windows 実装 (UI Automation)
- 統合テストとデバッグ

## 注意事項

1. **セキュリティ**: C# DLLによりスクリプトインジェクションを防ぐ
2. **権限**: Windows では UAC や管理者権限は不要（キーボードフックを使わない限り）
3. **アンチウイルス**: キーボードシミュレーションはアンチウイルスソフトに検出される可能性があるため、デジタル署名が重要
4. **互換性**: Windows 10/11 をターゲットとし、古いバージョンは考慮しない
5. **要件**: .NET 8.0 SDK が必要、PowerShell 実行ポリシーの設定が必要
6. **FFI**: ffi-napi のビルドには C++ コンパイラが必要（オプション依存関係として設定済み）

## 構築手順

### 前提条件
- Node.js 20 以上
- .NET 8.0 SDK
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
- ffi-napi ビルドエラー: Visual Studio Build Tools が必要（オプション）

## アーキテクチャ概要

### Mac版との違い

| 項目 | Mac版 | Windows版 |
|------|-------|-----------|
| **実装言語** | Swift | C# |
| **実行方式** | プロセス起動 | FFI直接呼び出し |
| **パフォーマンス** | プロセス起動オーバーヘッド有り | オーバーヘッドなし |
| **セキュリティ** | コンパイル済みバイナリ | コンパイル済みDLL |
| **ビルド要件** | Xcode | .NET 8.0 SDK |

### 実装済みの機能

#### ✅ window-detector
- `GetCurrentApp()` - アクティブアプリケーション取得
- `GetActiveWindowBounds()` - ウィンドウ位置・サイズ取得
- Win32 API（GetForegroundWindow, GetWindowRect）を使用
- JSON形式で結果を返す

#### ⏳ keyboard-simulator（実装中）
- `SendKeyboardInput()` - Ctrl+V シミュレーション
- `ActivateApp()` - アプリケーションアクティベーション
- Win32 API（SendInput, SetForegroundWindow）を使用

#### ⏳ text-field-detector（未実装）
- `GetActiveTextFieldBounds()` - フォーカス中テキストフィールド検出
- UI Automation API を使用予定

### 技術的な選択理由

1. **C# DLL + FFI**：プロセス起動のオーバーヘッドを回避
2. **.NET 8.0**：最新の UnmanagedCallersOnly サポート
3. **PowerShell ビルド**：Windows 標準環境でのビルド
4. **ffi-napi**：オプション依存関係として設定し、ビルドエラーを回避

### Windows ネイティブツール開発戦略

#### 採用: C# DLL + FFI アプローチ

**利点:**
- プロセス起動のオーバーヘッドなし（Mac版の問題を解決）
- C# の開発効率
- .NET 8.0 の UnmanagedCallersOnly による高速な相互運用
- 型安全性とメモリ管理

**実装例:**
```csharp
// native-win/WindowDetector.cs
[UnmanagedCallersOnly(EntryPoint = "GetCurrentApp")]
public static IntPtr GetCurrentApp()
{
    var hWnd = GetForegroundWindow();
    GetWindowThreadProcessId(hWnd, out uint processId);
    var processName = GetProcessName(processId);
    
    var appInfo = new AppInfo
    {
        Name = processName,
        BundleId = null
    };
    
    return Marshal.StringToHGlobalAnsi(JsonSerializer.Serialize(appInfo));
}
```

```javascript
// src/platform/windows-platform-tools.ts
const ffi = require('ffi-napi');
const ref = require('ref-napi');

const windowDetector = ffi.Library('WindowDetector.dll', {
    'GetCurrentApp': ['pointer', []],
    'GetActiveWindowBounds': ['pointer', []]
});

const result = windowDetector.GetCurrentApp();
const json = ref.readCString(result);
return JSON.parse(json);
```

### 実装済みファイル一覧

1. **scripts/** ✅
   - `compile-platform.js` - OS 検出とビルド振り分け ✅
   - `copy-renderer-files.js` - クロスプラットフォームファイルコピー ✅
   - `clean.js` - クロスプラットフォームクリーンアップ ✅
   - `build-windows-tools.js` - Windows C# DLL ビルド ✅

2. **native-win/** ✅
   - `WindowDetector.csproj` - .NET 8.0 プロジェクト ✅
   - `WindowDetector.cs` - C# 実装 ✅
   - `build.ps1` - PowerShell ビルドスクリプト ✅
   - `README.md` - 実装ドキュメント ✅

3. **assets/** ✅
   - `Prompt-Line.ico` - Windows アイコン（256x256, 128x128, 64x64, 32x32, 16x16）✅

## 参考リソース

- [Win32 API Documentation](https://docs.microsoft.com/en-us/windows/win32/)
- [UI Automation Overview](https://docs.microsoft.com/en-us/windows/win32/winauto/uiauto-uiautomationoverview)
- [Electron Platform-Specific Code](https://www.electronjs.org/docs/latest/tutorial/platform-integration)
- [.NET 8.0 P/Invoke Documentation](https://docs.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke)
- [ffi-napi Documentation](https://github.com/node-ffi-napi/node-ffi-napi)