#!/usr/bin/env node

/**
 * 機能テストスクリプト
 * セキュリティ強化後の機能確認用
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('=== Prompt Line 機能テスト ===');

// アプリケーションを起動
const appPath = path.join(__dirname, 'dist', 'main.js');
const child = spawn('./node_modules/.bin/electron', [appPath], {
  stdio: 'pipe',
  env: { ...process.env, NODE_ENV: 'development' }
});

let output = '';
let hasStarted = false;

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log('STDOUT:', text.trim());
  
  if (text.includes('Prompt Line initialized successfully')) {
    hasStarted = true;
    console.log('✅ アプリケーション起動成功');
  }
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log('STDERR:', text.trim());
  
  // プリロードスクリプトの初期化確認
  if (text.includes('Secure preload script initialized')) {
    console.log('✅ プリロードスクリプト初期化成功');
  }
  
  // レンダラー初期化確認
  if (text.includes('Prompt Line renderer initialized')) {
    console.log('✅ レンダラープロセス初期化成功');
  }
  
  // エラーチェック
  if (text.includes('Error') || text.includes('EROR')) {
    console.log('❌ エラー検出:', text.trim());
  }
});

child.on('close', (code) => {
  console.log(`\n=== テスト完了 (終了コード: ${code}) ===`);
  
  if (hasStarted) {
    console.log('✅ 基本起動テスト: 成功');
  } else {
    console.log('❌ 基本起動テスト: 失敗');
  }
  
  // セキュリティ警告をチェック
  const securityWarnings = output.match(/Security Warning/g);
  if (securityWarnings) {
    console.log(`⚠️  セキュリティ警告: ${securityWarnings.length}件`);
  } else {
    console.log('✅ セキュリティ警告: なし');
  }
  
  // IPC通信エラーをチェック
  if (output.includes('Unauthorized channel') || output.includes('Electron API not available')) {
    console.log('❌ IPC通信エラー検出');
  } else {
    console.log('✅ IPC通信: 正常');
  }
});

// 10秒後に強制終了
setTimeout(() => {
  console.log('\n⏰ タイムアウト - アプリケーションを終了します');
  child.kill();
}, 10000);

console.log('📱 アプリケーション起動中...');
console.log('🎯 10秒間の動作確認を実施します');
console.log('⌨️  実際の機能テストは手動で実行してください:');
console.log('   1. Cmd+Shift+Space でウィンドウ表示');
console.log('   2. テキスト入力');
console.log('   3. Cmd+Enter で貼り付け');
console.log('   4. 履歴表示の確認');