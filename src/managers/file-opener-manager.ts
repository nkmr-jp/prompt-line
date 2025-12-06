import { execFile } from 'child_process';
import path from 'path';
import { logger } from '../utils/utils';
import type SettingsManager from './settings-manager';

interface OpenFileResult {
  success: boolean;
  error?: string;
}

export class FileOpenerManager {
  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  /**
   * ファイルを適切なアプリで開く
   */
  async openFile(filePath: string): Promise<OpenFileResult> {
    const settings = this.settingsManager.getSettings();
    const ext = path.extname(filePath).slice(1).toLowerCase();

    // 拡張子に対応するアプリを取得
    const app = settings.fileOpener?.extensions?.[ext]
                || settings.fileOpener?.defaultEditor;

    logger.debug('FileOpenerManager: openFile called', {
      filePath,
      ext,
      fileOpenerSettings: settings.fileOpener,
      selectedApp: app || 'system default'
    });

    if (app) {
      return this.openWithApp(filePath, app);
    }

    // デフォルト動作（システムデフォルトアプリ）
    return this.openWithDefault(filePath);
  }

  /**
   * 指定アプリでファイルを開く（execFileを使用 - シェルインジェクション防止）
   */
  private openWithApp(filePath: string, appName: string): Promise<OpenFileResult> {
    return new Promise((resolve) => {
      // execFileを使用（引数を配列で渡すことでシェルインジェクションを防止）
      // デフォルトでアプリはフロントに持ってくる（-g を付けないことでフォアグラウンドで開く）
      execFile('open', ['-a', appName, filePath], (error) => {
        if (error) {
          // アプリが見つからない等のエラー時はフォールバック
          logger.warn(`Failed to open with ${appName}, falling back to default`, {
            error: error.message,
            filePath
          });
          // フォールバック：システムデフォルトで開く
          this.openWithDefault(filePath).then(resolve);
          return;
        }

        logger.info('File opened successfully with configured app', {
          filePath,
          app: appName
        });
        resolve({ success: true });
      });
    });
  }

  /**
   * システムデフォルトで開く
   * openコマンドを使用してアプリをフォアグラウンドで開く
   */
  private openWithDefault(filePath: string): Promise<OpenFileResult> {
    return new Promise((resolve) => {
      // openコマンドを使用（shell.openPathはアプリをフロントに持ってこない場合がある）
      // -g オプションを付けないことでフォアグラウンドで開く
      execFile('open', [filePath], (error) => {
        if (error) {
          logger.error('Failed to open file with default app', {
            error: error.message,
            filePath
          });
          resolve({ success: false, error: error.message });
          return;
        }

        logger.info('File opened successfully with default app', { filePath });
        resolve({ success: true });
      });
    });
  }

  /**
   * 指定された拡張子に対して設定されているアプリ名を取得
   */
  getAppForExtension(extension: string): string | null {
    const settings = this.settingsManager.getSettings();
    const ext = extension.startsWith('.') ? extension.slice(1) : extension;
    return settings.fileOpener?.extensions?.[ext.toLowerCase()] || null;
  }

  /**
   * デフォルトエディタを取得
   */
  getDefaultEditor(): string | null {
    const settings = this.settingsManager.getSettings();
    return settings.fileOpener?.defaultEditor || null;
  }
}

export default FileOpenerManager;
