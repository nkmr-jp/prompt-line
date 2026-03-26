/**
 * jq-resolver - jq-web (WebAssembly版jq) のラッパーモジュール
 *
 * 遅延初期化でjqインスタンスを管理し、jq式を評価する
 */

import { logger } from '../utils/utils';

// jq-web の型定義
interface JqInstance {
  json(data: unknown, expression: string): unknown;
  raw(jsonstring: string, filter: string, flags: string[]): string | undefined;
}

let jqInstance: JqInstance | null = null;
let jqInitPromise: Promise<JqInstance> | null = null;

/** 失敗キャッシュ: (filepath + expression) の組み合わせで短期間の再評価を防止 */
const failureCache = new Map<string, number>();
const FAILURE_CACHE_TTL = 30_000; // 30秒
const FAILURE_CACHE_MAX_SIZE = 200;

/**
 * 失敗キャッシュから期限切れエントリを削除する
 * キャッシュサイズが上限を超えた場合に呼び出される
 */
function evictExpiredFailures(): void {
  const now = Date.now();
  for (const [key, timestamp] of failureCache) {
    if (now - timestamp >= FAILURE_CACHE_TTL) {
      failureCache.delete(key);
    }
  }
}

/**
 * jq-web インスタンスを遅延初期化で取得
 */
async function getJqInstance(): Promise<JqInstance> {
  if (jqInstance) return jqInstance;

  if (!jqInitPromise) {
    jqInitPromise = (async () => {
      logger.debug('jq-web: initializing WASM module...');
      try {
        const jqModule = require('jq-web');
        const instance = await jqModule;
        jqInstance = instance;
        logger.debug('jq-web: initialized successfully');
        return instance;
      } catch (error) {
        logger.error('jq-web: WASM initialization failed', { error: error instanceof Error ? error.message : String(error) });
        jqInitPromise = null;
        throw error;
      }
    })();
  }

  return jqInitPromise;
}

/** jq-web raw() に渡すフラグ（compact output） */
const JQ_RAW_FLAGS = ['-c'];

/**
 * jq-web の json() を安全にラップする
 * jq-web の json() は内部で raw().trim() を呼ぶが、select() でフィルタアウトされた場合
 * raw() が undefined を返し、undefined.trim() で TypeError が発生する。
 * この関数は raw() を直接呼び、undefined を安全にハンドリングする。
 */
function safeJqJson(jq: JqInstance, data: unknown, expression: string): unknown {
  const jsonstring = JSON.stringify(data);
  const rawResult = jq.raw(jsonstring, expression, JQ_RAW_FLAGS);
  if (rawResult === undefined || rawResult === null) return undefined;
  const trimmed = rawResult.trim();
  if (!trimmed) return undefined;

  if (trimmed.includes('\n')) {
    return trimmed.split('\n').filter(Boolean).map(line => JSON.parse(line));
  }
  return JSON.parse(trimmed);
}

/**
 * jq式を評価し、結果をJS値で返す
 * - エラー時は null を返す
 * - cacheKey を指定すると、失敗した組み合わせを短期キャッシュして再評価を防止
 *   （例: ファイルパスを渡して同じファイル+式の繰り返し失敗を回避）
 */
export async function evaluateJq(data: unknown, expression: string, cacheKey?: string): Promise<unknown> {
  // 失敗キャッシュチェック: cacheKey が指定されている場合のみ
  if (cacheKey) {
    const failureKey = `${cacheKey}\0${expression}`;
    const failedAt = failureCache.get(failureKey);
    if (failedAt && Date.now() - failedAt < FAILURE_CACHE_TTL) {
      return null;
    }
  }

  try {
    const jq = await getJqInstance();
    const result = safeJqJson(jq, data, expression);
    if (result === undefined) {
      // select() filtered out the data — expected, not an error
      return null;
    }
    logger.debug('jq evaluation success', { expression, resultType: typeof result, isArray: Array.isArray(result) });
    return result;
  } catch (error) {
    logger.warn('jq evaluation failed', { expression, error: error instanceof Error ? error.message : String(error) });
    // 失敗をキャッシュ
    if (cacheKey) {
      const failureKey = `${cacheKey}\0${expression}`;
      failureCache.set(failureKey, Date.now());
      // サイズ上限を超えたら期限切れエントリを掃除
      if (failureCache.size > FAILURE_CACHE_MAX_SIZE) {
        evictExpiredFailures();
      }
    }
    return null;
  }
}
