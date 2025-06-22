#!/bin/bash

echo "=== Hardened Runtime 段階的テスト ==="

# 色付きの出力のための関数
print_status() {
    case $1 in
        "info") echo "ℹ️  $2" ;;
        "success") echo "✅ $2" ;;
        "warning") echo "⚠️  $2" ;;
        "error") echo "❌ $2" ;;
    esac
}

# 設定のバックアップ作成
print_status "info" "現在の設定をバックアップ中..."
cp package.json package.json.backup

# ステップ1: 現在の設定（hardenedRuntime: false）でビルド
print_status "info" "ステップ1: 現在の設定でテストビルド..."
npm run clean
npm run compile

if [ $? -ne 0 ]; then
    print_status "error" "コンパイルに失敗しました"
    exit 1
fi

print_status "success" "コンパイル成功"

# ビルドディレクトリの確認
if [ ! -d "dist" ]; then
    print_status "error" "dist ディレクトリが作成されていません"
    exit 1
fi

print_status "success" "現在の設定でのビルドが成功しました"

# ステップ2: Hardened Runtime 有効化
print_status "info" "ステップ2: Hardened Runtime を有効化..."

# package.json の hardenedRuntime を true に変更
sed -i '' 's/"hardenedRuntime": false/"hardenedRuntime": true/' package.json

if grep -q '"hardenedRuntime": true' package.json; then
    print_status "success" "Hardened Runtime を有効化しました"
else
    print_status "error" "Hardened Runtime の有効化に失敗しました"
    exit 1
fi

# ステップ3: Hardened Runtime有効でのビルドテスト
print_status "info" "ステップ3: Hardened Runtime有効でのビルドテスト..."
npm run clean

# コンパイル（main.jsなどの作成）
npm run compile

if [ $? -ne 0 ]; then
    print_status "error" "Hardened Runtime有効でのコンパイルに失敗しました"
    # 設定を元に戻す
    cp package.json.backup package.json
    exit 1
fi

print_status "success" "Hardened Runtime有効でのコンパイル成功"

# ステップ4: entitlements.mac.plist の確認
print_status "info" "ステップ4: entitlements設定の確認..."

ENTITLEMENTS_FILE="build/entitlements.mac.plist"
if [ -f "$ENTITLEMENTS_FILE" ]; then
    print_status "success" "entitlements ファイルが存在します"
    
    # 必要なentitlementsが含まれているかチェック
    if grep -q "com.apple.security.automation.apple-events" "$ENTITLEMENTS_FILE"; then
        print_status "success" "AppleScript権限が設定されています"
    else
        print_status "warning" "AppleScript権限が設定されていません"
    fi
    
    if grep -q "com.apple.security.cs.disable-library-validation" "$ENTITLEMENTS_FILE"; then
        print_status "info" "ライブラリ検証無効化が設定されています"
    else
        print_status "info" "ライブラリ検証無効化が設定されていません"
    fi
    
else
    print_status "error" "entitlements ファイルが見つかりません"
    # 設定を元に戻す
    cp package.json.backup package.json
    exit 1
fi

# ステップ5: afterSign.js の動作確認（シミュレーション）
print_status "info" "ステップ5: afterSign.js の動作確認..."

# afterSign.jsが存在し、実行可能かチェック
AFTERSIGN_FILE="scripts/afterSign.js"
if [ -f "$AFTERSIGN_FILE" ]; then
    print_status "success" "afterSign.js が存在します"
    
    # ファイルの構文チェック（node.js構文確認）
    node -c "$AFTERSIGN_FILE"
    if [ $? -eq 0 ]; then
        print_status "success" "afterSign.js の構文は正常です"
    else
        print_status "error" "afterSign.js に構文エラーがあります"
        # 設定を元に戻す
        cp package.json.backup package.json
        exit 1
    fi
else
    print_status "error" "afterSign.js が見つかりません"
    # 設定を元に戻す
    cp package.json.backup package.json
    exit 1
fi

# ステップ6: 最終確認
print_status "info" "ステップ6: 最終設定確認..."

echo "現在のpackage.json設定:"
grep -A 5 -B 5 "hardenedRuntime" package.json

print_status "success" "=== Hardened Runtime テスト完了 ==="
print_status "info" "変更を保持する場合は、そのまま利用してください"
print_status "info" "元に戻す場合は: cp package.json.backup package.json"

echo ""
echo "次のステップ:"
echo "1. npm run build でフルビルドを実行"
echo "2. 生成されたアプリケーションの動作確認"
echo "3. 署名とentitlementsの検証"