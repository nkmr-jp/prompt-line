/**
 * 初期化可能なマネージャーのインターフェース
 */
// @ts-nocheck

export interface IInitializable {
  /**
   * マネージャーを初期化する
   * - DOM要素の取得
   * - イベントリスナーの設定
   */
  initialize(): void | Promise<void>;

  /**
   * マネージャーを破棄する（オプション）
   * - イベントリスナーの解除
   * - リソースの解放
   */
  destroy?(): void;
}
