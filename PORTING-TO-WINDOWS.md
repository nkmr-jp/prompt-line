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

2. **C# with .NET**
   - 利点: 開発が容易、豊富なライブラリ
   - 欠点: .NET ランタイムが必要

3. **Node.js ネイティブモジュール**
   - 利点: JavaScript との統合が容易
   - 欠点: ビルドが複雑

### 推奨実装

C++ with Win32 API を推奨（Swift 版と同様のスタンドアロンバイナリとして）

```cpp
// window-detector.cpp の例
#include <windows.h>
#include <json/json.h>

Json::Value getActiveWindowBounds() {
    HWND hwnd = GetForegroundWindow();
    RECT rect;
    GetWindowRect(hwnd, &rect);
    
    Json::Value result;
    result["x"] = rect.left;
    result["y"] = rect.top;
    result["width"] = rect.right - rect.left;
    result["height"] = rect.bottom - rect.top;
    return result;
}
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
- [ ] window-detector の Windows 実装 (Win32 API)
- [ ] keyboard-simulator の Windows 実装 (SendInput API)
- [ ] text-field-detector の Windows 実装 (UI Automation)
- [ ] Windows 版アクセシビリティ権限チェック
- [ ] キーボードショートカットの調整 (Cmd→Ctrl)

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

**完了済み (Phase 1-2):**
- プラットフォーム抽象化レイヤー (`src/platform/`) を実装済み
- Mac 専用コードをプラットフォーム依存部分として分離
- Windows 版は stub 実装で警告メッセージを出力
- TypeScript ビルドエラーを全て解決
- クロスプラットフォームビルドスクリプトを作成・テスト済み
- Windows 向け electron-builder 設定を追加
- 基本ビルドが Windows 環境で動作することを確認

**実装済みのファイル:**
- `scripts/compile-platform.js` - プラットフォーム検出とビルド振り分け
- `scripts/copy-renderer-files.js` - クロスプラットフォームファイルコピー
- `scripts/clean.js` - クロスプラットフォームクリーンアップ
- `scripts/build-windows-tools.js` - Windows ツールビルド（プレースホルダー）
- `src/platform/` - プラットフォーム抽象化レイヤー
- `assets/Prompt-Line.ico` - Windows アイコン（プレースホルダー）
- `package.json` - 更新済み（クロスプラットフォーム対応、Windows ビルド設定）

**次のステップ (Phase 3):**
- Windows ネイティブツール実装 (Win32 API)
- または Phase 5 での基本機能テスト

## 注意事項

1. **セキュリティ**: Windows でも同様にコンパイル済みバイナリを使用し、スクリプトインジェクションを防ぐ
2. **権限**: Windows では UAC や管理者権限は不要（キーボードフックを使わない限り）
3. **アンチウイルス**: キーボードシミュレーションはアンチウイルスソフトに検出される可能性があるため、デジタル署名が重要
4. **互換性**: Windows 10/11 をターゲットとし、古いバージョンは考慮しない

## ビルドシステムの詳細

### 現在のビルドスクリプトの問題点

#### package.json のスクリプト
```json
"compile": "tsc && npm run build:renderer && cd native && make install && cp -r ../src/native-tools ../dist/"
"build:renderer": "vite build && cp src/renderer/input.html dist/renderer/input.html && cp -r src/renderer/styles dist/renderer/"
"clean": "rm -rf dist/mac* dist/*.dmg dist/*.zip dist/*.blockmap"
```

**Windows での問題:**
- `make` コマンドが利用不可
- `cp`、`rm` などの Unix コマンドが動作しない
- パスセパレータの違い

### クロスプラットフォーム対応案

#### 1. プラットフォーム検出スクリプト
```javascript
// scripts/compile-platform.js
const os = require('os');
const { execSync } = require('child_process');

const platform = os.platform();

if (platform === 'darwin') {
  execSync('npm run compile:mac', { stdio: 'inherit' });
} else if (platform === 'win32') {
  execSync('npm run compile:win', { stdio: 'inherit' });
}
```

#### 2. ファイル操作スクリプト
```javascript
// scripts/copy-renderer-files.js
const fs = require('fs-extra');
const path = require('path');

// HTML ファイルのコピー
fs.copySync(
  path.join('src', 'renderer', 'input.html'),
  path.join('dist', 'renderer', 'input.html')
);

// スタイルディレクトリのコピー
fs.copySync(
  path.join('src', 'renderer', 'styles'),
  path.join('dist', 'renderer', 'styles')
);
```

### Windows 向け electron-builder 設定

```json
{
  "build": {
    // 既存の設定...
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "ia32"]
        },
        {
          "target": "portable"
        }
      ],
      "icon": "assets/Prompt-Line.ico",
      "publisherName": "Prompt Line Developer",
      "verifyUpdateCodeSignature": false,
      "requestedExecutionLevel": "asInvoker"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Prompt Line"
    }
  }
}
```

### Windows ネイティブツール開発戦略

#### 推奨: Node.js ネイティブモジュール

**利点:**
- Electron との統合が容易
- npm でのパッケージ管理
- TypeScript の型定義が可能

**実装例:**
```javascript
// src/native-tools-win/window-detector.js
const addon = require('./build/Release/window_detector.node');

module.exports = {
  getActiveWindowBounds: () => {
    return addon.getActiveWindowBounds();
  },
  getCurrentApp: () => {
    return addon.getCurrentApp();
  }
};
```

**binding.gyp の例:**
```json
{
  "targets": [
    {
      "target_name": "window_detector",
      "sources": ["src/window_detector.cc"],
      "include_dirs": ["<!(node -e \"require('nan')\")"],
      "conditions": [
        ["OS=='win'", {
          "libraries": ["user32.lib"]
        }]
      ]
    }
  ]
}
```

### 必要な新規ファイル一覧

1. **scripts/** ✅
   - `compile-platform.js` - OS 検出とビルド振り分け ✅
   - `copy-renderer-files.js` - クロスプラットフォームファイルコピー ✅
   - `clean.js` - クロスプラットフォームクリーンアップ ✅
   - `build-windows-tools.js` - Windows ツールビルド ✅

2. **src/native-tools-win/** ⏳
   - `window-detector.cc` - ウィンドウ検出
   - `keyboard-simulator.cc` - キーボードシミュレーション
   - `text-field-detector.cc` - テキストフィールド検出
   - `binding.gyp` - ビルド設定

3. **assets/** ✅
   - `Prompt-Line.ico` - Windows アイコン（256x256, 128x128, 64x64, 32x32, 16x16）✅

### プラットフォーム抽象化レイヤー ✅

```typescript
// src/platform/platform-interface.ts ✅
export interface IPlatformTools {
  getActiveWindowBounds(): Promise<WindowBounds>;
  getCurrentApp(): Promise<AppInfo>;
  pasteText(): Promise<void>;
  activateApp(identifier: string): Promise<void>;
  getActiveTextFieldBounds(): Promise<TextFieldBounds | null>;
}

// src/platform/platform-factory.ts ✅
export function createPlatformTools(): IPlatformTools {
  if (process.platform === 'darwin') {
    return new MacPlatformTools();
  } else if (process.platform === 'win32') {
    return new WindowsPlatformTools();
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}
```

**実装済みファイル:**
- `src/platform/platform-interface.ts` - プラットフォーム共通インターフェース ✅
- `src/platform/platform-factory.ts` - プラットフォーム検出とファクトリー ✅
- `src/platform/mac-platform-tools.ts` - Mac 実装 ✅
- `src/platform/windows-platform-tools.ts` - Windows スタブ実装 ✅

## 参考リソース

- [Win32 API Documentation](https://docs.microsoft.com/en-us/windows/win32/)
- [UI Automation Overview](https://docs.microsoft.com/en-us/windows/win32/winauto/uiauto-uiautomationoverview)
- [Electron Platform-Specific Code](https://www.electronjs.org/docs/latest/tutorial/platform-integration)
- [Node.js Native Addons](https://nodejs.org/api/addons.html)
- [node-gyp Documentation](https://github.com/nodejs/node-gyp)