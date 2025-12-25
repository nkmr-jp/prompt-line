import { execFile } from 'child_process';
import path from 'path';
import { logger } from '../utils/utils';
import type SettingsManager from './settings-manager';

interface OpenFileResult {
  success: boolean;
  error?: string;
}

interface OpenFileOptions {
  lineNumber?: number;
  columnNumber?: number;
}

// Editor CLI commands and their line number support
interface EditorConfig {
  // CLI command to use (if different from app name)
  cli?: string;
  // Format for line number argument: 'goto' = --goto file:line, 'line' = --line N file, 'colon' = file:line
  lineFormat?: 'goto' | 'line' | 'colon' | 'url';
  // URL scheme for JetBrains-style navigation
  urlScheme?: string;
  // Use 'open -na <appName> --args' for macOS apps that accept file:line as argument
  useOpenArgs?: boolean;
}

// Known editors and their configurations
const EDITOR_CONFIGS: Record<string, EditorConfig> = {
  // VSCode and variants
  'Visual Studio Code': { cli: 'code', lineFormat: 'goto' },
  'Visual Studio Code - Insiders': { cli: 'code-insiders', lineFormat: 'goto' },
  'VSCodium': { cli: 'codium', lineFormat: 'goto' },
  'Cursor': { cli: 'cursor', lineFormat: 'goto' },
  'Windsurf': { cli: 'windsurf', lineFormat: 'goto' },
  // JetBrains IDEs (use 'open -na <app> --args file:line' for reliable line number support)
  'IntelliJ IDEA': { useOpenArgs: true },
  'IntelliJ IDEA Ultimate': { useOpenArgs: true },
  'IntelliJ IDEA Community': { useOpenArgs: true },
  'WebStorm': { useOpenArgs: true },
  'PyCharm': { useOpenArgs: true },
  'PyCharm Professional': { useOpenArgs: true },
  'PyCharm Community': { useOpenArgs: true },
  'GoLand': { useOpenArgs: true },
  'RubyMine': { useOpenArgs: true },
  'PhpStorm': { useOpenArgs: true },
  'CLion': { useOpenArgs: true },
  'Rider': { useOpenArgs: true },
  'DataGrip': { useOpenArgs: true },
  'AppCode': { useOpenArgs: true },
  'Android Studio': { useOpenArgs: true },
  // Other editors
  'Sublime Text': { cli: 'subl', lineFormat: 'colon' },
  'TextMate': { cli: 'mate', lineFormat: 'line' },
  'Atom': { cli: 'atom', lineFormat: 'colon' },
  'Zed': { cli: 'zed', lineFormat: 'colon' },
};

export class FileOpenerManager {
  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  /**
   * ファイルを適切なアプリで開く
   * @param filePath ファイルパス
   * @param options オプション（行番号など）
   */
  async openFile(filePath: string, options?: OpenFileOptions): Promise<OpenFileResult> {
    const settings = this.settingsManager.getSettings();
    const ext = path.extname(filePath).slice(1).toLowerCase();

    // 拡張子に対応するアプリを取得
    const app = settings.fileOpener?.extensions?.[ext]
                || settings.fileOpener?.defaultEditor;

    logger.debug('FileOpenerManager: openFile called', {
      filePath,
      ext,
      lineNumber: options?.lineNumber,
      fileOpenerSettings: settings.fileOpener,
      selectedApp: app || 'system default'
    });

    if (app) {
      return this.openWithApp(filePath, app, options);
    }

    // デフォルト動作（システムデフォルトアプリ）
    return this.openWithDefault(filePath);
  }

  /**
   * 指定アプリでファイルを開く（execFileを使用 - シェルインジェクション防止）
   */
  private openWithApp(filePath: string, appName: string, options?: OpenFileOptions): Promise<OpenFileResult> {
    return new Promise((resolve) => {
      if (!this.isValidAppName(appName)) {
        this.openWithDefault(filePath).then(resolve);
        return;
      }

      const editorConfig = EDITOR_CONFIGS[appName];
      if (options?.lineNumber && editorConfig) {
        this.handleLineNumberOpen(filePath, appName, editorConfig, options, resolve);
        return;
      }

      this.openWithAppSimple(filePath, appName).then(resolve);
    });
  }

  private isValidAppName(appName: string): boolean {
    if (!appName || typeof appName !== 'string') {
      logger.warn('Invalid app name provided', { appName });
      return false;
    }

    if (appName.includes('..') || appName.includes('/')) {
      logger.warn('Potentially malicious app name detected', { appName });
      return false;
    }

    return true;
  }

  private handleLineNumberOpen(
    filePath: string,
    appName: string,
    config: EditorConfig,
    options: OpenFileOptions,
    resolve: (value: OpenFileResult) => void
  ): void {
    this.openWithLineNumber(filePath, appName, config, options)
      .then(resolve)
      .catch(() => {
        logger.warn('Line number open failed, falling back to regular open', { appName, filePath });
        this.openWithAppSimple(filePath, appName).then(resolve);
      });
  }

  /**
   * シンプルなアプリ起動（行番号なし）
   */
  private openWithAppSimple(filePath: string, appName: string): Promise<OpenFileResult> {
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
   * 行番号指定でファイルを開く
   */
  private openWithLineNumber(
    filePath: string,
    appName: string,
    config: EditorConfig,
    options: OpenFileOptions
  ): Promise<OpenFileResult> {
    return new Promise((resolve, reject) => {
      const lineNumber = options.lineNumber || 1;
      const columnNumber = options.columnNumber || 1;

      logger.debug('Opening file with line number', {
        filePath,
        appName,
        lineNumber,
        columnNumber,
        config
      });

      if (config.useOpenArgs) {
        this.openWithJetBrainsArgs(filePath, appName, lineNumber).then(resolve).catch(reject);
        return;
      }

      if (config.urlScheme) {
        this.openWithUrlScheme(filePath, appName, config.urlScheme, lineNumber).then(resolve).catch(reject);
        return;
      }

      if (config.cli) {
        this.openWithCli(filePath, config.cli, config.lineFormat, lineNumber, columnNumber).then(resolve).catch(reject);
        return;
      }

      reject(new Error('No line number handling available for this editor'));
    });
  }

  private openWithJetBrainsArgs(filePath: string, appName: string, lineNumber: number): Promise<OpenFileResult> {
    return new Promise((resolve, reject) => {
      const args = ['-na', appName, '--args', '--line', String(lineNumber), filePath];
      logger.debug('Opening with open -na --args (JetBrains style)', { appName, args });

      execFile('open', args, (error) => {
        if (error) {
          logger.warn('open -na --args failed', { error: error.message, appName, args });
          reject(error);
          return;
        }
        logger.info('File opened successfully with open -na --args', {
          filePath,
          lineNumber,
          app: appName
        });
        resolve({ success: true });
      });
    });
  }

  private openWithUrlScheme(filePath: string, appName: string, urlScheme: string, lineNumber: number): Promise<OpenFileResult> {
    return new Promise((resolve, reject) => {
      const url = `${urlScheme}://open?file=${encodeURIComponent(filePath)}&line=${lineNumber}`;
      logger.debug('Opening with JetBrains URL scheme', { url });

      execFile('open', [url], (error) => {
        if (error) {
          logger.warn('JetBrains URL scheme failed', { error: error.message, url });
          reject(error);
          return;
        }
        logger.info('File opened successfully with JetBrains URL scheme', {
          filePath,
          lineNumber,
          app: appName
        });
        resolve({ success: true });
      });
    });
  }

  private openWithCli(
    filePath: string,
    cli: string,
    lineFormat: EditorConfig['lineFormat'],
    lineNumber: number,
    columnNumber: number
  ): Promise<OpenFileResult> {
    return new Promise((resolve, reject) => {
      const args = this.buildCliArgs(filePath, lineFormat, lineNumber, columnNumber);
      logger.debug('Opening with CLI', { cli, args });

      execFile(cli, args, (error) => {
        if (error) {
          logger.warn('CLI open failed', { error: error.message, cli, args });
          reject(error);
          return;
        }
        logger.info('File opened successfully with CLI', {
          filePath,
          lineNumber,
          cli
        });
        resolve({ success: true });
      });
    });
  }

  private buildCliArgs(
    filePath: string,
    lineFormat: EditorConfig['lineFormat'],
    lineNumber: number,
    columnNumber: number
  ): string[] {
    switch (lineFormat) {
      case 'goto':
        return ['--goto', `${filePath}:${lineNumber}:${columnNumber}`];
      case 'line':
        return ['-l', String(lineNumber), filePath];
      case 'colon':
        return [`${filePath}:${lineNumber}:${columnNumber}`];
      default:
        return [filePath];
    }
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
