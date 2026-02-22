/**
 * jq-resolver - jq-web (WebAssembly版jq) のラッパーモジュール
 *
 * 遅延初期化でjqインスタンスを管理し、jq式を評価する
 */

import { logger } from '../utils/utils';

// jq-web の型定義
interface JqInstance {
  json(data: unknown, expression: string): unknown;
}

let jqInstance: JqInstance | null = null;
let jqInitPromise: Promise<JqInstance> | null = null;

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

/**
 * jq式を評価し、結果をJS値で返す
 * - エラー時は null を返す
 */
export async function evaluateJq(data: unknown, expression: string): Promise<unknown> {
  try {
    const jq = await getJqInstance();
    const result = jq.json(data, expression);
    logger.debug('jq evaluation success', { expression, resultType: typeof result, isArray: Array.isArray(result) });
    return result;
  } catch (error) {
    logger.warn('jq evaluation failed', { expression, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
