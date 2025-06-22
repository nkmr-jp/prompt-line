#!/usr/bin/env node

/**
 * 履歴機能の負荷テスト・ベンチマークスクリプト
 * Usage: node benchmark-history.js
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// テスト用のOptimizedHistoryManagerクラス（簡略版）
class TestOptimizedHistoryManager {
  constructor(historyFile) {
    this.historyFile = historyFile;
    this.recentCache = [];
    this.cacheSize = 100;
    this.totalItemCount = 0;
  }

  async initialize() {
    const startTime = performance.now();
    
    try {
      // ファイルサイズを取得
      const stats = await fs.promises.stat(this.historyFile);
      this.fileSize = stats.size;
      
      // 最新N件を読み込む（簡略版）
      await this.loadRecentHistory();
      await this.countTotalItems();
      
      const endTime = performance.now();
      return {
        success: true,
        initTime: endTime - startTime,
        fileSize: this.fileSize,
        totalItems: this.totalItemCount,
        cachedItems: this.recentCache.length
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        error: error.message,
        initTime: endTime - startTime
      };
    }
  }

  async loadRecentHistory() {
    const data = await fs.promises.readFile(this.historyFile, 'utf8');
    const lines = data.trim().split('\n').filter(line => line.trim());
    
    this.recentCache = [];
    
    // 最後からN件を取得（新しい順）
    const startIndex = Math.max(0, lines.length - this.cacheSize);
    for (let i = lines.length - 1; i >= startIndex; i--) {
      try {
        const item = JSON.parse(lines[i]);
        if (item && item.text && item.timestamp && item.id) {
          this.recentCache.push(item);
        }
      } catch (parseError) {
        // 無視
      }
    }
  }

  async countTotalItems() {
    const data = await fs.promises.readFile(this.historyFile, 'utf8');
    const lines = data.trim().split('\n').filter(line => line.trim());
    this.totalItemCount = lines.length;
  }

  async searchHistory(query, limit = 10) {
    const startTime = performance.now();
    const results = [];
    
    // キャッシュから検索
    for (const item of this.recentCache) {
      if (item.text.toLowerCase().includes(query.toLowerCase())) {
        results.push(item);
        if (results.length >= limit) break;
      }
    }
    
    // 足りなければファイルから検索（簡略版）
    if (results.length < limit) {
      const data = await fs.promises.readFile(this.historyFile, 'utf8');
      const lines = data.trim().split('\n').filter(line => line.trim());
      
      const cachedIds = new Set(this.recentCache.map(item => item.id));
      
      for (const line of lines) {
        if (results.length >= limit) break;
        
        try {
          const item = JSON.parse(line);
          if (item && !cachedIds.has(item.id) && 
              item.text.toLowerCase().includes(query.toLowerCase())) {
            results.push(item);
          }
        } catch (parseError) {
          // 無視
        }
      }
    }
    
    const endTime = performance.now();
    return {
      results: results.slice(0, limit),
      searchTime: endTime - startTime,
      resultCount: results.length
    };
  }

  async addToHistory(text, appName = null) {
    const startTime = performance.now();
    
    const item = {
      text: text,
      timestamp: Date.now(),
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
    };
    
    // appNameがある場合は追加
    if (appName) {
      item.appName = appName;
    }
    
    // キャッシュに追加
    this.recentCache.unshift(item);
    if (this.recentCache.length > this.cacheSize) {
      this.recentCache.pop();
    }
    
    // ファイルに追記
    const line = JSON.stringify(item) + '\n';
    await fs.promises.appendFile(this.historyFile, line);
    
    this.totalItemCount++;
    
    const endTime = performance.now();
    return {
      item: item,
      addTime: endTime - startTime
    };
  }
}

class BenchmarkRunner {
  constructor() {
    this.results = {};
  }

  async runBenchmarks() {
    console.log('🚀 History Manager Performance Benchmark\n');
    
    // 1. 初期化性能テスト
    await this.testInitializationPerformance();
    
    // 2. 検索性能テスト
    await this.testSearchPerformance();
    
    // 3. 追加性能テスト
    await this.testAddPerformance();
    
    // 4. メモリ使用量テスト
    await this.testMemoryUsage();
    
    // 結果をレポート
    this.generateReport();
  }

  async testInitializationPerformance() {
    console.log('📊 Testing Initialization Performance...');
    
    const testSizes = [100, 500, 1000, 5000, 10000];
    this.results.initialization = {};
    
    for (const size of testSizes) {
      const testFile = path.join(__dirname, 'data', `test-history-${size}.jsonl`);
      
      // テストファイルが存在しない場合は生成
      if (!fs.existsSync(testFile)) {
        console.log(`  Generating test file for ${size} items...`);
        const { generateTestHistory } = require('./generate-test-history');
        generateTestHistory(size, testFile);
      }
      
      console.log(`  Testing with ${size} items...`);
      
      const manager = new TestOptimizedHistoryManager(testFile);
      const result = await manager.initialize();
      
      this.results.initialization[size] = {
        initTime: result.initTime,
        fileSize: result.fileSize,
        totalItems: result.totalItems,
        cachedItems: result.cachedItems,
        success: result.success
      };
      
      console.log(`    Init time: ${result.initTime.toFixed(2)}ms`);
      console.log(`    File size: ${(result.fileSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`    Total items: ${result.totalItems}`);
      console.log(`    Cached items: ${result.cachedItems}`);
    }
    
    console.log('');
  }

  async testSearchPerformance() {
    console.log('🔍 Testing Search Performance...');
    
    const testFile = path.join(__dirname, 'data', 'test-history-5000.jsonl');
    const manager = new TestOptimizedHistoryManager(testFile);
    await manager.initialize();
    
    const searchQueries = [
      'function',     // 一般的なキーワード
      'test',         // 頻出キーワード
      'React',        // 特定のキーワード
      'デバッグ',      // 日本語キーワード
      'xyz123',       // 存在しないキーワード
      'console.log',  // コードキーワード
      'api',          // 短いキーワード
      'implementation' // 長いキーワード
    ];
    
    this.results.search = {};
    
    for (const query of searchQueries) {
      console.log(`  Searching for "${query}"...`);
      
      const times = [];
      const resultCounts = [];
      
      // 5回実行して平均を取る
      for (let i = 0; i < 5; i++) {
        const result = await manager.searchHistory(query, 10);
        times.push(result.searchTime);
        resultCounts.push(result.resultCount);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const avgResults = resultCounts.reduce((a, b) => a + b, 0) / resultCounts.length;
      
      this.results.search[query] = {
        avgSearchTime: avgTime,
        avgResults: avgResults,
        minTime: Math.min(...times),
        maxTime: Math.max(...times)
      };
      
      console.log(`    Avg time: ${avgTime.toFixed(2)}ms`);
      console.log(`    Avg results: ${avgResults.toFixed(1)}`);
    }
    
    console.log('');
  }

  async testAddPerformance() {
    console.log('➕ Testing Add Performance...');
    
    const testFile = path.join(__dirname, 'data', 'test-add-performance.jsonl');
    
    // 空のファイルから開始
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    fs.writeFileSync(testFile, '');
    
    const manager = new TestOptimizedHistoryManager(testFile);
    await manager.initialize();
    
    const testTexts = [
      'Short text',
      'Medium length text that contains multiple words and should test the add functionality properly.',
      'This is a very long text that simulates what might happen when users paste large amounts of content into the application. It includes multiple sentences and should test the performance of adding longer text items to the history.',
      'コードサンプル: function test() { console.log("テスト"); }',
      'JSON example: {"name": "test", "value": 123, "nested": {"key": "value"}}'
    ];
    
    // テスト用のアプリ名
    const testAppNames = [
      'Terminal',
      'Visual Studio Code',
      'Slack',
      null,
      'Claude Code'
    ];
    
    this.results.add = {
      individual: {},
      batch: {}
    };
    
    // 個別追加テスト
    console.log('  Testing individual adds...');
    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i];
      const appName = testAppNames[i % testAppNames.length];
      const result = await manager.addToHistory(text, appName);
      
      this.results.add.individual[`text_${i + 1}`] = {
        addTime: result.addTime,
        textLength: text.length,
        appName: appName || 'none'
      };
      
      console.log(`    Text ${i + 1}: ${result.addTime.toFixed(2)}ms (${text.length} chars, app: ${appName || 'none'})`);
    }
    
    // バッチ追加テスト
    console.log('  Testing batch adds...');
    const batchSizes = [10, 50, 100];
    
    for (const batchSize of batchSizes) {
      const startTime = performance.now();
      
      for (let i = 0; i < batchSize; i++) {
        const text = `Batch test item ${i + 1}`;
        // バッチテストでもアプリ名をランダムに選択
        const appName = i % 3 === 0 ? null : testAppNames[i % testAppNames.length];
        await manager.addToHistory(text, appName);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / batchSize;
      
      this.results.add.batch[`batch_${batchSize}`] = {
        totalTime: totalTime,
        avgTimePerItem: avgTime,
        itemsPerSecond: (batchSize / totalTime) * 1000
      };
      
      console.log(`    Batch ${batchSize}: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(2)}ms/item`);
    }
    
    // クリーンアップ
    fs.unlinkSync(testFile);
    console.log('');
  }

  async testMemoryUsage() {
    console.log('💾 Testing Memory Usage...');
    
    const testSizes = [1000, 5000, 10000];
    this.results.memory = {};
    
    for (const size of testSizes) {
      const testFile = path.join(__dirname, 'data', `test-history-${size}.jsonl`);
      
      // メモリ使用量測定
      const beforeMemory = process.memoryUsage();
      
      const manager = new TestOptimizedHistoryManager(testFile);
      await manager.initialize();
      
      const afterMemory = process.memoryUsage();
      
      const memoryDiff = {
        rss: afterMemory.rss - beforeMemory.rss,
        heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
        heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal
      };
      
      this.results.memory[size] = {
        memoryDiff: memoryDiff,
        memoryPerItem: memoryDiff.heapUsed / size
      };
      
      console.log(`  ${size} items:`);
      console.log(`    Heap used: ${(memoryDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`    RSS: ${(memoryDiff.rss / 1024 / 1024).toFixed(2)}MB`);
      console.log(`    Memory per item: ${(memoryDiff.heapUsed / size).toFixed(0)} bytes`);
    }
    
    console.log('');
  }

  generateReport() {
    console.log('📋 Performance Report\n');
    
    // 初期化性能レポート
    console.log('🚀 Initialization Performance:');
    console.log('Items\tInit Time(ms)\tFile Size(MB)\tCached Items');
    console.log('-----\t-------------\t-------------\t------------');
    for (const [size, result] of Object.entries(this.results.initialization)) {
      console.log(
        `${size}\t${result.initTime.toFixed(1)}\t\t${(result.fileSize / 1024 / 1024).toFixed(1)}\t\t${result.cachedItems}`
      );
    }
    
    console.log('\n🔍 Search Performance:');
    console.log('Query\t\tAvg Time(ms)\tAvg Results\tMin Time(ms)\tMax Time(ms)');
    console.log('-----\t\t------------\t-----------\t------------\t------------');
    for (const [query, result] of Object.entries(this.results.search)) {
      console.log(
        `${query.padEnd(12)}\t${result.avgSearchTime.toFixed(1)}\t\t${result.avgResults.toFixed(1)}\t\t${result.minTime.toFixed(1)}\t\t${result.maxTime.toFixed(1)}`
      );
    }
    
    console.log('\n➕ Add Performance:');
    console.log('Individual adds:');
    for (const [key, result] of Object.entries(this.results.add.individual)) {
      console.log(`  ${key}: ${result.addTime.toFixed(2)}ms (${result.textLength} chars)`);
    }
    
    console.log('Batch adds:');
    for (const [key, result] of Object.entries(this.results.add.batch)) {
      console.log(`  ${key}: ${result.avgTimePerItem.toFixed(2)}ms/item, ${result.itemsPerSecond.toFixed(0)} items/sec`);
    }
    
    console.log('\n💾 Memory Usage:');
    console.log('Items\tHeap Used(MB)\tMemory per Item(bytes)');
    console.log('-----\t-------------\t---------------------');
    for (const [size, result] of Object.entries(this.results.memory)) {
      console.log(
        `${size}\t${(result.memoryDiff.heapUsed / 1024 / 1024).toFixed(2)}\t\t${result.memoryPerItem.toFixed(0)}`
      );
    }
    
    // JSONファイルとして保存
    const reportFile = path.join(__dirname, 'reports', `benchmark-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
  }
}

// CLI実行
if (require.main === module) {
  const runner = new BenchmarkRunner();
  runner.runBenchmarks().catch(console.error);
}

module.exports = { BenchmarkRunner };