# アイコン作成ガイド

## アイコンファイルについて

- `icon.svg` - オリジナルのSVGアイコン
- `create_icns.sh` - macOS標準ツールを使用したicnsファイル作成スクリプト

## icnsファイルの作成方法

SVGアイコンから必要なサイズのPNGファイルを生成し、icnsファイルを作成：

```bash
cd assets
chmod +x create_icns.sh
./create_icns.sh
```

このスクリプトは以下を実行します：
1. `rsvg-convert`を使用してSVGから各サイズのPNGを生成
2. `iconutil`を使用してPNGファイルからicnsファイルを作成

## 必要なツール

- `rsvg-convert` (librsvg): SVGからPNG変換用
- `iconutil` (macOS標準): icnsファイル作成用

インストール方法：
```bash
brew install librsvg
```