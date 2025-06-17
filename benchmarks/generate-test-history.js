#!/usr/bin/env node

/**
 * 負荷テスト用のhistory.jsonlファイル生成スクリプト
 * Usage: node generate-test-history.js [count] [output-file]
 */

const fs = require('fs');
const path = require('path');

// アプリケーション名のパターン
const appNames = [
  'Terminal',
  'iTerm2',
  'Code',
  'Cursor',
  'Windsurf',
  'Sublime Text',
  'Slack',
  'Chrome',
  'Obsidian',
  'Notion',
  'Linear',
  'Xcode',
  'GoLand',
  'Claude',
  null, // 時々nullを含める（アプリ名が取得できなかった場合をシミュレート）
];

// サンプルテキストのパターン
const textPatterns = {
  shortTexts: [
    'Hello World',
    'Test message',
    'Quick note',
    'Sample text',
    'Debug info',
    'Error log',
    'User input',
    'API response',
    'Configuration',
    'Development',
    'こんにちは',
    'テストメッセージ',
    'サンプルテキスト',
    'デバッグ情報',
    'エラーログ',
    'ユーザー入力',
    'API レスポンス',
    '設定ファイル',
    '開発用',
    'プログラミング'
  ],
  mediumTexts: [
    'This is a medium length text that might be used for testing the history functionality. It contains multiple words and should test the search capabilities.',
    'プログラムのデバッグ時によく使用される中程度の長さのテキストです。検索機能のテストに適しており、日本語と英語が混在しています。',
    'function calculateSum(a, b) {\n  return a + b;\n}\nconsole.log(calculateSum(1, 2));',
    'SELECT * FROM users WHERE created_at > \'2024-01-01\' ORDER BY id DESC LIMIT 10;',
    'docker run -d --name nginx-container -p 8080:80 nginx:latest',
    'git commit -m "feat: add unlimited history functionality with optimized performance"',
    'npm install express cors dotenv helmet morgan compression',
    'curl -X POST https://api.example.com/v1/users -H "Content-Type: application/json" -d \'{"name": "John", "email": "john@example.com"}\'',
    'この文章は中程度の長さのテキストとして作成されました。履歴機能のテストに使用され、検索やパフォーマンスの評価に役立ちます。',
    'const OptimizedHistoryManager = require("./optimized-history-manager");\nconst manager = new OptimizedHistoryManager();\nawait manager.initialize();'
  ],
  longTexts: [
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.`,
    `これは非常に長いテキストの例です。日本語での長文テストを行うために作成されました。プログラムの履歴機能において、長いテキストの処理性能や検索機能の動作を確認するために使用されます。データベースのクエリ、API のレスポンス、設定ファイルの内容、ログファイルの出力など、実際のアプリケーションで扱われる可能性のある長いテキストを模擬しています。検索機能のテストでは、この長いテキストの中から特定のキーワードを見つけ出せるかどうかを確認します。また、メモリ使用量やレスポンス時間の測定にも使用されます。`,
    `function OptimizedHistoryManager() {
  this.recentCache = [];
  this.cacheSize = 100;
  this.historyFile = config.paths.historyFile;
  this.totalItemCount = 0;
  this.appendQueue = [];
  this.debouncedAppend = debounce(this.flushAppendQueue.bind(this), 100);
  this.duplicateCheckSet = new Set();
}

OptimizedHistoryManager.prototype.initialize = async function() {
  try {
    await this.ensureHistoryFile();
    await this.loadRecentHistory();
    await this.countTotalItems();
    logger.info(\`Optimized history manager initialized with \${this.recentCache.length} cached items, total: \${this.totalItemCount}\`);
  } catch (error) {
    logger.error('Failed to initialize optimized history manager:', error);
    this.recentCache = [];
    this.totalItemCount = 0;
  }
};`,
    `{
  "name": "prompt-line",
  "version": "1.4.0",
  "description": "A floating text input for macOS that enables quick text entry across any application",
  "main": "dist/main.js",
  "scripts": {
    "start": "npm run compile && electron .",
    "dev": "npm run compile && NODE_ENV=development electron .",
    "compile": "tsc && node scripts/fix-renderer.js && cd native && make install && cp -r ../src/native-tools ../dist/",
    "build": "npm run compile && electron-builder",
    "build:x64": "npm run compile && electron-builder --x64",
    "build:arm64": "npm run compile && electron-builder --arm64",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["electron", "macos", "clipboard", "text-input", "productivity"],
  "author": "nkmr-jp",
  "license": "MIT"
}`
  ],
  codeSnippets: [
    'console.log("Hello, World!");',
    'import React from "react";',
    'const [state, setState] = useState(null);',
    'await fetch("/api/users");',
    'docker-compose up -d',
    'git push origin main',
    'npm run build',
    'yarn install',
    'pip install requests',
    'python main.py',
    'java -jar app.jar',
    'mvn clean install',
    'kubectl apply -f deployment.yaml',
    'terraform plan',
    'ansible-playbook playbook.yml',
    'cargo build --release',
    'go mod tidy',
    'dotnet restore',
    'composer install',
    'bundle install'
  ],
  searchTerms: [
    'function',
    'import',
    'export',
    'const',
    'let',
    'var',
    'async',
    'await',
    'Promise',
    'React',
    'Vue',
    'Angular',
    'Node',
    'Express',
    'API',
    'HTTP',
    'JSON',
    'SQL',
    'database',
    'server',
    'client',
    'frontend',
    'backend',
    'deploy',
    'build',
    'test',
    'debug',
    'error',
    'log',
    'config',
    'docker',
    'kubernetes',
    'git',
    'github',
    'npm',
    'yarn',
    'webpack',
    'babel',
    'typescript',
    '関数',
    'インポート',
    'エクスポート',
    '非同期',
    'プロミス',
    'データベース',
    'サーバー',
    'クライアント',
    'フロントエンド',
    'バックエンド',
    'デプロイ',
    'ビルド',
    'テスト',
    'デバッグ',
    'エラー',
    'ログ',
    '設定'
  ]
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomText(index, totalCount) {
  const progress = index / totalCount;
  
  // テキストの長さの分布を調整
  let textType;
  if (progress < 0.7) {
    textType = 'shortTexts'; // 70%は短いテキスト
  } else if (progress < 0.9) {
    textType = 'mediumTexts'; // 20%は中程度
  } else {
    textType = 'longTexts'; // 10%は長いテキスト
  }
  
  // コードスニペットも混在させる
  if (Math.random() < 0.15) {
    textType = 'codeSnippets';
  }
  
  let text = getRandomElement(textPatterns[textType]);
  
  // 検索テスト用にキーワードを含むテキストを一定割合で生成
  if (Math.random() < 0.3) {
    const searchTerm = getRandomElement(textPatterns.searchTerms);
    text = `${text} ${searchTerm} example`;
  }
  
  return text;
}

function generateHistoryItem(index, totalCount, baseTimestamp) {
  // タイムスタンプは新しい順になるように（最新が一番上）
  const timeOffset = Math.floor(Math.random() * 60 * 60 * 24 * 30 * 1000); // 30日間の範囲
  const timestamp = baseTimestamp - (index * 1000) - timeOffset;
  
  // アプリ名を選択（70%の確率でアプリ名を含める）
  const appName = Math.random() < 0.7 ? getRandomElement(appNames) : null;
  
  const item = {
    text: generateRandomText(index, totalCount),
    timestamp: timestamp,
    id: generateId()
  };
  
  // appNameがnullでない場合のみフィールドを追加
  if (appName !== null) {
    item.appName = appName;
  }
  
  return item;
}

function generateTestHistory(count = 1000, outputFile = null) {
  console.log(`Generating ${count} history items...`);
  
  const baseTimestamp = Date.now();
  const items = [];
  
  // プログレス表示用
  const progressInterval = Math.max(1, Math.floor(count / 10));
  
  for (let i = 0; i < count; i++) {
    items.push(generateHistoryItem(i, count, baseTimestamp));
    
    if (i % progressInterval === 0) {
      const progress = Math.floor((i / count) * 100);
      console.log(`Progress: ${progress}%`);
    }
  }
  
  // JSONLフォーマットで出力
  const jsonlContent = items
    .map(item => JSON.stringify(item))
    .join('\n') + '\n';
  
  // 出力ファイルの決定
  if (!outputFile) {
    outputFile = path.join(__dirname, 'data', `test-history-${count}.jsonl`);
  }
  
  // dataディレクトリが存在しない場合は作成
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputFile, jsonlContent);
  
  console.log(`Generated ${count} items`);
  console.log(`File size: ${(jsonlContent.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Output: ${outputFile}`);
  
  // 統計情報
  const textLengths = items.map(item => item.text.length);
  const avgLength = Math.round(textLengths.reduce((a, b) => a + b, 0) / textLengths.length);
  const maxLength = Math.max(...textLengths);
  const minLength = Math.min(...textLengths);
  
  console.log(`\nStatistics:`);
  console.log(`  Average text length: ${avgLength} characters`);
  console.log(`  Min text length: ${minLength} characters`);
  console.log(`  Max text length: ${maxLength} characters`);
  console.log(`  Total characters: ${textLengths.reduce((a, b) => a + b, 0)}`);
  
  return outputFile;
}

// CLI実行
if (require.main === module) {
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 1000;
  const outputFile = args[1];
  
  generateTestHistory(count, outputFile);
}

module.exports = { generateTestHistory };