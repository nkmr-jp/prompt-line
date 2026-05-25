# Lessons

## P2 (TimeSlot 除去) で Space 切替検出が回帰

**症状**: 別 Space で show すると元の Space に戻されてしまう。

**原因**: ultra-fast 検出は frontmost app だけが本来の信号源。TimeSlot は「キャッシュ TTL 超過後の signature 強制ローテーション」として機能していた。これを削除すると、同じアプリのまま Space を切り替えた場合、signature が変わらず → reuse path で元の Space のウィンドウが flash される。

**ハンドオフレポートに「実際の Space 切替の検出が壊れないか手動確認が必要」と書かれていたが、計測値の改善に注目して見落とした。**

**次の試行案**:
- Space 切替検出には CGSWorkspace API (Carbon の private) や `Mission Control` の AppleScript polling など別の手段が必要
- ultra-fast モード自体が「frontmost app だけで Space を区別する」前提のため、TimeSlot を消すなら同時に別の Space 切替検出を入れる
- もしくは TimeSlot の周期を 1s から数十秒に伸ばし、ジッターを許容する妥協案

**教訓**: 「計測上で `flags.signatureChanged=false` になっている = 正しく動いている」とは限らない。動作の意図（Space 切替時に false 以外）を満たすかは UI 操作で別途確認すること。
