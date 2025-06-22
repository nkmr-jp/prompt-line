/**
 * AppleScript Sanitizer - 安全なAppleScript実行のためのサニタイゼーション
 * 
 * AppleScriptコマンドを安全に実行するため、全ての危険な文字をエスケープし
 * インジェクション攻撃を防止します。
 */

/**
 * AppleScriptコマンドを安全にサニタイズする
 * 全ての危険な文字をエスケープしてインジェクション攻撃を防ぐ
 * 
 * @param input - サニタイズするAppleScript文字列
 * @returns サニタイズされた安全なAppleScript文字列
 * @throws Error - 入力が文字列でない場合、または長すぎる場合
 */
export function sanitizeAppleScript(input: string): string {
  // 入力検証
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // 最大長制限（64KB）- AppleScriptの実用的な上限
  if (input.length > 65536) {
    throw new Error('AppleScript input too long (max 64KB)');
  }

  return input
    // バックスラッシュ（最初に処理する必要がある）
    .replace(/\\/g, '\\\\')
    // 単引用符（AppleScriptの文字列区切り文字）
    .replace(/'/g, "\\'")
    // 二重引用符
    .replace(/"/g, '\\"')
    // 改行文字
    .replace(/\n/g, '\\n')
    // キャリッジリターン
    .replace(/\r/g, '\\r')
    // タブ文字
    .replace(/\t/g, '\\t')
    // ドル記号（変数展開防止）
    .replace(/\$/g, '\\$')
    // バッククォート（コマンド実行防止）
    .replace(/`/g, '\\`')
    // NULL文字削除
    .replace(/\x00/g, '')
    // その他の制御文字削除（ASCII 1-31, 127）
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * AppleScriptを安全に実行するためのラッパー関数
 * サニタイゼーションとタイムアウト処理を含む
 * 
 * @param script - 実行するAppleScript
 * @param timeout - タイムアウト時間（ミリ秒、デフォルト: 3000）
 * @returns Promise<string> - AppleScriptの実行結果
 */
export function executeAppleScriptSafely(script: string, timeout: number = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const sanitizedScript = sanitizeAppleScript(script);
      
      // child_processを動的にインポート（循環参照回避）
      const { exec } = require('child_process');
      
      exec(`osascript -e '${sanitizedScript}'`, 
        { timeout, killSignal: 'SIGTERM' as const }, 
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            reject(new Error(`AppleScript execution failed: ${error.message}`));
            return;
          }
          
          if (stderr && stderr.trim()) {
            reject(new Error(`AppleScript stderr: ${stderr.trim()}`));
            return;
          }
          
          resolve(stdout.trim());
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * AppleScript実行のセキュリティ検証
 * 危険なパターンをチェックして警告を出力
 * 
 * @param script - 検証するAppleScript
 * @returns 危険なパターンが検出された場合の警告配列
 */
export function validateAppleScriptSecurity(script: string): string[] {
  const warnings: string[] = [];
  
  // 危険なパターンのチェック
  const dangerousPatterns = [
    { pattern: /do shell script/i, warning: 'shell script execution detected' },
    { pattern: /system events.*keystroke/i, warning: 'keystroke injection detected' },
    { pattern: /tell application ".*".*quit/i, warning: 'application termination detected' },
    { pattern: /delete|remove|trash/i, warning: 'file deletion commands detected' },
    { pattern: /password|credential/i, warning: 'sensitive data access detected' }
  ];

  for (const { pattern, warning } of dangerousPatterns) {
    if (pattern.test(script)) {
      warnings.push(warning);
    }
  }

  return warnings;
}