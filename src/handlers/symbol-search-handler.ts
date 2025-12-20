import { IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/utils';
import { CodeSymbolSearcher } from '../lib/code-symbol-searcher';
import type SettingsManager from '../managers/settings-manager';
import type { SymbolSearchResult, CodeSymbolSearchUserConfig } from '../types';

/**
 * デフォルトのコードシンボル検索設定
 */
const DEFAULT_CONFIG: CodeSymbolSearchUserConfig = {
  enabled: false,
  maxResults: 50,
  timeout: 5000
};

/**
 * SymbolSearchHandler manages all IPC handlers related to code symbol search functionality.
 * This includes symbol search, language list, and configuration retrieval.
 */
class SymbolSearchHandler {
  private settingsManager: SettingsManager;
  private searcher: CodeSymbolSearcher;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;

    // Initialize searcher with current config
    const config = this.getConfig();
    this.searcher = new CodeSymbolSearcher(config);
  }

  /**
   * 現在の設定を取得（デフォルト値でマージ）
   */
  private getConfig(): CodeSymbolSearchUserConfig {
    const userConfig = this.settingsManager.getCodeSymbolSearchSettings();
    if (!userConfig) {
      return DEFAULT_CONFIG;
    }
    return {
      enabled: userConfig.enabled ?? DEFAULT_CONFIG.enabled,
      maxResults: userConfig.maxResults ?? DEFAULT_CONFIG.maxResults,
      timeout: userConfig.timeout ?? DEFAULT_CONFIG.timeout
    };
  }

  /**
   * 機能が有効かどうかを確認
   */
  isEnabled(): boolean {
    const config = this.settingsManager.getCodeSymbolSearchSettings();
    return config?.enabled === true;
  }

  /**
   * Register all symbol search related IPC handlers
   */
  setupHandlers(ipcMain: typeof import('electron').ipcMain): void {
    ipcMain.handle('search-symbols', this.handleSearchSymbols.bind(this));
    ipcMain.handle('get-symbol-languages', this.handleGetSymbolLanguages.bind(this));
    ipcMain.handle('get-symbol-config', this.handleGetSymbolConfig.bind(this));

    logger.info('SymbolSearch IPC handlers set up successfully');
  }

  /**
   * Remove all symbol search related IPC handlers
   */
  removeHandlers(ipcMain: typeof import('electron').ipcMain): void {
    const handlers = [
      'search-symbols',
      'get-symbol-languages',
      'get-symbol-config'
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    logger.info('SymbolSearch IPC handlers removed');
  }

  /**
   * Handler: search-symbols
   * Execute symbol search in the specified directory
   *
   * @param directory - 検索対象ディレクトリ
   * @param language - 言語 (go, ts, py, etc.)
   * @param query - 検索クエリ
   * @param symbolType - シンボルタイプ（オプション）
   */
  private async handleSearchSymbols(
    _event: IpcMainInvokeEvent,
    directory: string,
    language: string,
    query: string,
    symbolType?: string
  ): Promise<SymbolSearchResult[]> {
    try {
      // 入力バリデーション
      if (!directory || typeof directory !== 'string') {
        logger.debug('Symbol search: invalid directory', { directory });
        return [];
      }

      if (!language || typeof language !== 'string') {
        logger.debug('Symbol search: invalid language', { language });
        return [];
      }

      // 機能が無効の場合
      if (!this.isEnabled()) {
        logger.debug('Symbol search: feature is disabled');
        return [];
      }

      // 設定を最新の状態に更新
      const config = this.getConfig();
      this.searcher.updateConfig(config);

      // 検索実行
      const results = await this.searcher.search(
        directory,
        language,
        query,
        symbolType
      );

      logger.debug('Symbol search completed', {
        directory,
        language,
        query,
        symbolType,
        resultCount: results.length
      });

      return results;
    } catch (error) {
      logger.error('Failed to search symbols:', error);
      return [];
    }
  }

  /**
   * Handler: get-symbol-languages
   * Get list of supported programming languages
   */
  private handleGetSymbolLanguages(
    _event: IpcMainInvokeEvent
  ): string[] {
    try {
      const languages = this.searcher.getSupportedLanguages();
      logger.debug('Symbol languages requested', { count: languages.length });
      return languages;
    } catch (error) {
      logger.error('Failed to get symbol languages:', error);
      return [];
    }
  }

  /**
   * Handler: get-symbol-config
   * Get current symbol search configuration
   */
  private handleGetSymbolConfig(
    _event: IpcMainInvokeEvent
  ): CodeSymbolSearchUserConfig {
    try {
      const config = this.getConfig();
      logger.debug('Symbol config requested', { config });
      return config;
    } catch (error) {
      logger.error('Failed to get symbol config:', error);
      return DEFAULT_CONFIG;
    }
  }
}

export default SymbolSearchHandler;
