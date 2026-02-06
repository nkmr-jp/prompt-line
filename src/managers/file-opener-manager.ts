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

// Editor configuration for line number support
// All editors use 'open -na <appName> --args' for reliable macOS integration
interface EditorConfig {
  // Always true - use 'open -na <appName> --args' to launch
  useOpenArgs: boolean;
  // Format for line number argument: 'goto' = --goto file:line:col, 'line' = -l N file, 'colon' = file:line:col
  // Default (undefined) = JetBrains style: --line N file
  lineFormat?: 'goto' | 'line' | 'colon';
}

// Known editors and their configurations
// All editors use 'open -na <app> --args ...' for reliable macOS integration without CLI dependency
const EDITOR_CONFIGS: Record<string, EditorConfig> = {
  // VSCode and variants (--goto file:line:column)
  'Visual Studio Code': { useOpenArgs: true, lineFormat: 'goto' },
  'Visual Studio Code - Insiders': { useOpenArgs: true, lineFormat: 'goto' },
  'VSCodium': { useOpenArgs: true, lineFormat: 'goto' },
  'Cursor': { useOpenArgs: true, lineFormat: 'goto' },
  'Windsurf': { useOpenArgs: true, lineFormat: 'goto' },
  'Antigravity': { useOpenArgs: true, lineFormat: 'goto' },
  'Kiro': { useOpenArgs: true, lineFormat: 'goto' },
  // JetBrains IDEs (--line N file)
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
  'Sublime Text': { useOpenArgs: true, lineFormat: 'colon' },
  'TextMate': { useOpenArgs: true, lineFormat: 'line' },
  'Atom': { useOpenArgs: true, lineFormat: 'colon' },
  'Zed': { useOpenArgs: true, lineFormat: 'colon' },
};

/**
 * Case-insensitive lookup for editor config
 * Returns both the config and the canonical name from EDITOR_CONFIGS
 */
function findEditorConfig(appName: string): { config: EditorConfig; canonicalName: string } | null {
  // Try exact match first
  if (EDITOR_CONFIGS[appName]) {
    return { config: EDITOR_CONFIGS[appName], canonicalName: appName };
  }

  // Case-insensitive lookup
  const lowerAppName = appName.toLowerCase();
  for (const [key, config] of Object.entries(EDITOR_CONFIGS)) {
    if (key.toLowerCase() === lowerAppName) {
      return { config, canonicalName: key };
    }
  }

  return null;
}

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

    if (app) {
      return this.openWithApp(filePath, app, options);
    }

    // 行番号が指定されていてエディタ未設定の場合、デフォルトアプリを検出して行ジャンプを試みる
    if (options?.lineNumber) {
      try {
        const detectedApp = await this.detectDefaultApp(filePath);
        if (detectedApp) {
          const editorMatch = findEditorConfig(detectedApp);
          if (editorMatch) {
            logger.info('Detected default app for line number support', { detectedApp, filePath });
            return this.openWithApp(filePath, editorMatch.canonicalName, options);
          }
        }
      } catch {
        // Detection failed, fall through to default
      }
    }

    // デフォルト動作（システムデフォルトアプリ）
    return this.openWithDefault(filePath);
  }

  /**
   * 指定アプリでファイルを開く（execFileを使用 - シェルインジェクション防止）
   */
  private openWithApp(filePath: string, appName: string, options?: OpenFileOptions): Promise<OpenFileResult> {
    return new Promise((resolve) => {
      // アプリ名の検証
      if (!appName || typeof appName !== 'string') {
        logger.warn('Invalid app name provided', { appName });
        this.openWithDefault(filePath).then(resolve);
        return;
      }

      // パストラバーサルパターンの検出
      if (appName.includes('..') || appName.includes('/')) {
        logger.warn('Potentially malicious app name detected', { appName });
        this.openWithDefault(filePath).then(resolve);
        return;
      }

      // Check if we have a line number and the editor supports it
      // Use case-insensitive lookup for editor config
      const editorMatch = findEditorConfig(appName);
      if (options?.lineNumber && editorMatch) {
        this.openWithLineNumber(filePath, appName, editorMatch.config, options)
          .then(resolve)
          .catch(() => {
            // Fallback to regular open if line number open fails
            logger.warn('Line number open failed, falling back to regular open', { appName, filePath });
            this.openWithAppSimple(filePath, appName).then(resolve);
          });
        return;
      }

      // No line number or unsupported editor - use simple open
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
      // Validate inputs to prevent argument injection
      if (filePath.startsWith('-') || filePath.includes('\0')) {
        reject(new Error('Invalid file path'));
        return;
      }
      const lineNumber = Math.max(1, Math.min(options.lineNumber || 1, 999999));
      const columnNumber = Math.max(1, Math.min(options.columnNumber || 1, 9999));

      // Build app-specific arguments based on lineFormat
      let appArgs: string[];
      switch (config.lineFormat) {
        case 'goto':
          // VSCode/Cursor/Windsurf style: --goto file:line:column
          appArgs = ['--goto', `${filePath}:${lineNumber}:${columnNumber}`];
          break;
        case 'colon':
          // Sublime/Zed style: file:line:column
          appArgs = [`${filePath}:${lineNumber}:${columnNumber}`];
          break;
        case 'line':
          // TextMate style: -l <line> file
          appArgs = ['-l', String(lineNumber), filePath];
          break;
        default:
          // JetBrains IDEs: --line <line> file
          appArgs = ['--line', String(lineNumber), filePath];
          break;
      }

      // Launch via macOS 'open -na <app> --args ...'
      const args = ['-na', appName, '--args', ...appArgs];
      execFile('open', args, (error) => {
        if (error) {
          logger.warn('open -na --args failed', { error: error.message, appName, args });
          reject(error);
          return;
        }
        logger.info('File opened with line number', { filePath, lineNumber, app: appName });
        resolve({ success: true });
      });
    });
  }

  /**
   * macOSのデフォルトアプリを検出する
   * NSWorkspace APIを使用してファイルタイプに対応するデフォルトアプリ名を取得
   */
  private async detectDefaultApp(filePath: string): Promise<string | null> {
    if (process.platform !== 'darwin') return null;

    return new Promise((resolve) => {
      // Reject paths with control characters to prevent script injection
      if (filePath.includes('\n') || filePath.includes('\r') || filePath.includes('\0')) {
        logger.warn('Rejected file path with control characters', { filePath });
        resolve(null);
        return;
      }
      // Use JSON.stringify for safe JavaScript string escaping (handles all special characters)
      const safePathJson = JSON.stringify(filePath);
      const script = `ObjC.import("AppKit");var ws=$.NSWorkspace.sharedWorkspace;var url=$.NSURL.fileURLWithPath(${safePathJson});var appUrl=ws.URLForApplicationToOpenURL(url);appUrl?ObjC.unwrap(appUrl.deletingPathExtension.lastPathComponent):""`;

      execFile('osascript', ['-l', 'JavaScript', '-e', script], { timeout: 3000 }, (error, stdout) => {
        if (error || !stdout?.trim()) {
          resolve(null);
          return;
        }
        resolve(stdout.trim());
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
