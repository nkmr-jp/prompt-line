import { ipcMain, clipboard, nativeImage, IpcMainInvokeEvent, dialog } from 'electron';
import type { ClipboardItem } from 'electron';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import path from 'path';
import config, { isIsolatedInstance } from '../config/app-config';
import {
  logger,
  pasteWithNativeTool,
  activateAndPasteWithNativeTool,
  sleep,
  checkAccessibilityPermission,
  SecureErrors
} from '../utils/utils';
import { isITerm2, getITermSessionId, isCmux, isGhostty, isWezTerm } from '../utils/native-tools/app-detection';
import type WindowManager from '../managers/window';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type SettingsManager from '../managers/settings-manager';
import type { AppInfo, IHistoryManager } from '../types';

interface PasteResult {
  success: boolean;
  error?: string;
  warning?: string;
}

// Constants
const MAX_PASTE_TEXT_LENGTH_BYTES = 1024 * 1024; // 1MB limit for paste text
const CLIPBOARD_WRITE_TIMEOUT_MS = 2000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Image paths trigger a Claude Code paste bug on cmux/Ghostty/WezTerm (not
// reproducible on iTerm2): a paste containing an image path converts that
// path to an `[Image #N]` token and drops surrounding text, even when the
// path is meant to be read as plain text. Wrapping matched paths in
// backticks defeats Claude Code's image-path detection, so the whole paste
// arrives as literal text (confirmed against cmux/Ghostty/WezTerm/iTerm2).
// Match image paths in two flavors:
//   (a) `/<path>` or `@<path>` — directory portion may contain spaces, e.g.
//       `/Users/me/My Pictures/foo.png` or `@My Images/foo.png` (Prompt Line
//       generates paths like `@<imagesDirectory>/<timestamp>.<ext>` so a
//       user-configured imagesDirectory with spaces lands here verbatim).
//       Lazy match stops at the first `.<ext>` preceded by a non-whitespace
//       character, so a sentence like `これは /foo.png のテスト` only
//       captures `/foo.png`.
//   (b) `<non-whitespace>.<ext>` — a plain filename or path without spaces.
// The leading `(?<=^|\s)` / trailing `(?=\s|$)` anchors require a match to
// start and end at whitespace/string boundaries. Two reasons:
//   1. Correctness: without a trailing boundary, the extension could match
//      as a mere substring of a longer token (`readme.pngx`, `image.png.bak`),
//      corrupting text that isn't actually an image path.
//   2. Performance: without the leading boundary, `\S+\.(?:ext)` is retried
//      from every character offset inside a long non-matching run (e.g. a
//      pasted base64 blob or minified JS with no whitespace), causing
//      quadratic-time backtracking — a multi-minute UI freeze is reachable
//      at the paste-text size limit. Anchoring the match to only start at a
//      token boundary bounds backtracking to each token's own length.
const IMAGE_PATH_REGEX = /(?<=^|\s)(?:[/@][^\n]*?\S\.(?:png|jpg|jpeg|gif|webp)|\S+\.(?:png|jpg|jpeg|gif|webp))(?=\s|$)/gi;

export function wrapImagePathsInBackticks(text: string): string {
  return text.replace(IMAGE_PATH_REGEX, (match, offset: number) => {
    // Don't double-wrap a path the user already quoted in backticks themselves.
    const alreadyQuoted = text[offset - 1] === '`' && text[offset + match.length] === '`';
    return alreadyQuoted ? match : `\`${match}\``;
  });
}

// cmux/Ghostty/WezTerm + Claude Code triggers an image-path-dropped-when-
// mixed-with-text bug that is NOT reproducible on iTerm2, even though the
// underlying paste mechanism (Cmd+V CGEvent) is identical for Ghostty/
// WezTerm. The exact terminal-side cause is unclear (likely subtle
// differences in bracketed-paste timing/chunking), so we wrap image paths
// in backticks before writing to the clipboard for these terminals.
function isClaudeCodeAffectedTerminal(app: AppInfo | string | null): boolean {
  return isCmux(app) || isGhostty(app) || isWezTerm(app);
}

class PasteHandler {
  private windowManager: WindowManager;
  private historyManager: IHistoryManager;
  private draftManager: DraftManager;
  private directoryManager: DirectoryManager;
  private settingsManager: SettingsManager;

  constructor(
    windowManager: WindowManager,
    historyManager: IHistoryManager,
    draftManager: DraftManager,
    directoryManager: DirectoryManager,
    settingsManager: SettingsManager
  ) {
    this.windowManager = windowManager;
    this.historyManager = historyManager;
    this.draftManager = draftManager;
    this.directoryManager = directoryManager;
    this.settingsManager = settingsManager;
  }

  setupHandlers(ipcMainInstance: typeof ipcMain): void {
    ipcMainInstance.handle('paste-text', this.handlePasteText.bind(this));
    ipcMainInstance.handle('paste-image', this.handlePasteImage.bind(this));
  }

  removeHandlers(ipcMainInstance: typeof ipcMain): void {
    ipcMainInstance.removeAllListeners('paste-text');
    ipcMainInstance.removeAllListeners('paste-image');
    logger.info('Paste handlers removed');
  }

  /**
   * Validate paste text input
   */
  private validatePasteInput(text: string): PasteResult | null {
    if (typeof text !== 'string') {
      logger.warn('Invalid input type for paste text', { type: typeof text });
      return { success: false, error: SecureErrors.INVALID_INPUT };
    }

    if (!text.trim()) {
      return { success: false, error: SecureErrors.INVALID_INPUT };
    }

    const byteLength = Buffer.byteLength(text, 'utf8');
    if (byteLength > MAX_PASTE_TEXT_LENGTH_BYTES) {
      logger.warn('Text size exceeds limit', { size: byteLength, limit: MAX_PASTE_TEXT_LENGTH_BYTES });
      return { success: false, error: SecureErrors.SIZE_LIMIT_EXCEEDED };
    }

    return null; // Validation passed
  }

  /**
   * Extract app name from AppInfo or string
   */
  private extractAppName(previousApp: AppInfo | string | null): string | undefined {
    if (!previousApp) return undefined;
    if (typeof previousApp === 'string') return previousApp;
    return previousApp.name || undefined;
  }

  /**
   * Execute paste operation with proper app handling.
   * cmux goes via AppleScript `paste_from_clipboard` (Cmd+V CGEvent doesn't
   * reach its embedded Ghostty PTY); Ghostty/WezTerm/iTerm2/others all use
   * keyboard-simulator Cmd+V CGEvent.
   */
  private async executePasteOperation(previousApp: AppInfo | string | null): Promise<PasteResult> {
    // Pasting means activating whatever app is in front of the user and sending
    // it Cmd+V. An isolated verification instance must never do that.
    if (isIsolatedInstance()) {
      logger.info('Isolated instance: skipping native paste');
      return { success: true, warning: 'Isolated instance: native paste skipped' };
    }

    if (previousApp && config.platform.isMac) {
      await activateAndPasteWithNativeTool(previousApp);
      return { success: true };
    }

    if (config.platform.isMac) {
      const focusSuccess = await this.windowManager.focusPreviousApp();

      if (focusSuccess) {
        await sleep(config.timing.appFocusDelay);
        await pasteWithNativeTool();
        return { success: true };
      }

      await pasteWithNativeTool();
      logger.warn('Paste attempted without focus confirmation');
      return { success: true, warning: 'Could not focus previous application' };
    }

    logger.warn('Auto-paste not supported on this platform');
    return { success: true, warning: 'Auto-paste not supported on this platform' };
  }

  /**
   * Handle paste error with accessibility check
   */
  private async handlePasteError(error: Error): Promise<PasteResult> {
    logger.error('Paste operation failed:', { message: error.message, stack: error.stack });

    if (!config.platform.isMac) {
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }

    try {
      const { hasPermission, bundleId } = await checkAccessibilityPermission();
      if (!hasPermission) {
        logger.warn('Paste failed - accessibility permission not granted', { bundleId });
        this.showAccessibilityWarning(bundleId);
        return { success: false, error: SecureErrors.PERMISSION_DENIED };
      }
    } catch (accessibilityError) {
      const accErr = accessibilityError as Error;
      logger.error('Failed to check accessibility permission:', { message: accErr.message });
    }

    return { success: false, error: SecureErrors.OPERATION_FAILED };
  }

  private async handlePasteText(_event: IpcMainInvokeEvent, text: string): Promise<PasteResult> {
    try {
      const previousApp = await this.getPreviousAppAsync();
      const appName = this.extractAppName(previousApp);
      const previousBundleId = previousApp && typeof previousApp === 'object' ? previousApp.bundleId : null;
      logger.info('Paste text requested', { length: text.length, appName, bundleId: previousBundleId });

      const validationError = this.validatePasteInput(text);
      if (validationError) return validationError;

      const directory = this.directoryManager.getDirectory() || undefined;
      // Note: this also wraps a screenshot path inserted by handlePasteImage
      // (e.g. `@images/<timestamp>.png`), so on cmux/Ghostty/WezTerm it now
      // arrives as literal backtick-quoted text instead of auto-converting to
      // a Claude Code `[Image #N]` attachment the way it used to (and still
      // does on iTerm2). Intentional tradeoff of the fix above.
      const clipboardText =
        config.platform.isMac && isClaudeCodeAffectedTerminal(previousApp)
          ? wrapImagePathsInBackticks(text)
          : text;
      await Promise.all([
        (async () => {
          const itermSessionId = isITerm2(previousApp) ? await getITermSessionId() : undefined;
          await this.historyManager.addToHistory(text, appName, directory, itermSessionId);
        })(),
        this.setClipboardAsync(clipboardText),
      ]);

      // Preserve the saved draft if writing the clipboard fails or times out.
      await this.draftManager.clearDraft();
      await this.windowManager.hideInputWindow();
      await sleep(Math.max(config.timing.windowHideDelay, 5));

      try {
        return await this.executePasteOperation(previousApp);
      } catch (pasteError) {
        return await this.handlePasteError(pasteError as Error);
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to handle paste text:', { message: err.message, stack: err.stack });
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  /**
   * Generate timestamped filename for image
   */
  private generateImageFilename(): string {
    const now = new Date();
    const parts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '_',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ];
    return `${parts.join('')}.png`;
  }

  /**
   * Validate and normalize image file path
   */
  private validateImagePath(
    imagesDir: string,
    filename: string
  ): { valid: boolean; normalizedPath?: string; error?: string } {
    const SAFE_FILENAME_REGEX = /^[0-9_]+\.png$/;
    if (!SAFE_FILENAME_REGEX.test(filename)) {
      logger.error('Invalid filename generated', { filename });
      return { valid: false, error: 'Invalid filename' };
    }

    // resolve() rather than normalize(): imagesDirectory is passed through
    // from user settings verbatim, so it may carry a trailing slash, which
    // normalize() keeps. That would leave expectedDir as "/dir/" against a
    // dirname() of "/dir" and reject every single image paste.
    const filepath = path.join(imagesDir, filename);
    const expectedDir = path.resolve(imagesDir);
    const normalizedPath = path.resolve(imagesDir, filename);

    if (!normalizedPath.startsWith(expectedDir)) {
      logger.error('Attempted path traversal detected', { filepath, normalizedPath, source: 'handlePasteImage' });
      return { valid: false, error: 'Invalid file path' };
    }

    const actualDir = path.dirname(normalizedPath);
    if (actualDir !== expectedDir) {
      logger.error('Unexpected directory in path', { expected: expectedDir, actual: actualDir });
      return { valid: false, error: 'Invalid file path' };
    }

    return { valid: true, normalizedPath };
  }

  /**
   * Resolve the images directory. Returns the absolute path and, when
   * imagesDirectory is a relative setting with a valid CWD, the relative prefix.
   */
  private resolveImagesDir(): { absolute: string; relativePrefix?: string } {
    const imagesDirectory = this.settingsManager.getSettings().imagesDirectory;
    if (!imagesDirectory) {
      return { absolute: config.paths.imagesDir };
    }

    if (path.isAbsolute(imagesDirectory)) {
      return { absolute: imagesDirectory };
    }

    const cwd = this.directoryManager.getDirectory();
    if (cwd) {
      return { absolute: path.join(cwd, imagesDirectory), relativePrefix: imagesDirectory };
    }

    logger.warn('imagesDirectory is relative but no CWD available, falling back to default');
    return { absolute: config.paths.imagesDir };
  }

  /**
   * Read the clipboard image as PNG bytes, preserving image-data metadata.
   *
   * Electron 44 replaced the synchronous clipboard with the W3C-modelled API,
   * so `clipboard.readImage()` is gone. Two pasteboard shapes carry an image
   * and only the first is obvious:
   *
   * - Image *data*. macOS surfaces `image/png` whatever the source actually
   *   wrote — measured against a PNG entry, a TIFF-only entry and a
   *   `screencapture -c` screenshot, all decodable as PNG.
   * - An image copied as a *file*, i.e. Cmd+C in Finder. The pasteboard then
   *   carries `text/uri-list` and **no `image/png` at all** (measured:
   *   `clipboard.has('image/png')` is false). `readImage()` used to resolve
   *   that file itself — on Electron 43 the same pasteboard yields a 64x64
   *   image — so the file URL has to be followed here to keep Finder paste
   *   working.
   */
  private async readClipboardImage(): Promise<Buffer | null> {
    const items = await clipboard.read();
    logger.debug('Clipboard items read', { types: items.map(item => item.types) });

    for (const item of items) {
      const buffer = await this.readClipboardItem(item);
      if (buffer) return buffer;
    }
    return null;
  }

  /** Read one clipboard entry, preferring image data over a file reference. */
  private async readClipboardItem(item: ClipboardItem): Promise<Buffer | null> {
    try {
      if (item.types.includes('image/png')) {
        const blob = (await item.getType('image/png')) as Blob;
        const buffer = Buffer.from(await blob.arrayBuffer());
        // `types` is a snapshot but getType() reads the *live* pasteboard. If
        // it changed in between, this resolves with an empty blob rather than
        // rejecting, so an empty buffer means a lost race, not a bad image.
        if (buffer.length === 0) {
          logger.warn('Clipboard advertised image/png but returned no bytes; the pasteboard changed mid-read');
        } else {
          // Decode only to validate: re-encoding drops PNG color metadata and
          // blocks the main process. Keep the original bytes, and do not retain
          // the decoded bitmap across the filesystem awaits below. The signature
          // also rejects JPEG data mislabeled as PNG (createFromBuffer accepts it).
          if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) &&
              !nativeImage.createFromBuffer(buffer).isEmpty()) return buffer;
          logger.warn('Clipboard image/png could not be decoded', { bytes: buffer.length });
        }
      }

      if (item.types.includes('text/uri-list')) {
        return await this.readImageFromFileUrl(item);
      }
    } catch (error) {
      // One unreadable entry must not abort the scan of the rest.
      logger.warn('Failed to read a clipboard item:', error);
    }
    return null;
  }

  /** Follow a `text/uri-list` file URL, as readImage() did before Electron 44. */
  private async readImageFromFileUrl(item: ClipboardItem): Promise<Buffer | null> {
    const blob = (await item.getType('text/uri-list')) as Blob;
    const uri = Buffer.from(await blob.arrayBuffer())
      .toString('utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line.length > 0 && !line.startsWith('#'));

    if (!uri || !uri.startsWith('file://')) return null;

    let filePath: string;
    try {
      filePath = fileURLToPath(uri);
    } catch (error) {
      logger.warn('Clipboard file URL could not be parsed:', error);
      return null;
    }

    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) {
      logger.debug('Clipboard file URL does not point at an image', { filePath });
      return null;
    }
    // File URLs may point at JPEGs or other supported formats. Convert these
    // to match the generated .png filename, preserving the existing behavior.
    return image.toPNG();
  }

  private async handlePasteImage(_event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string; path?: string; relativePath?: string }> {
    // Reading the pasteboard is harmless, but the clear() below is not: an
    // isolated verification instance would wipe whatever the user has copied.
    if (isIsolatedInstance()) {
      logger.info('Isolated instance: skipping clipboard image read');
      return { success: false, error: 'No image in clipboard' };
    }

    try {
      logger.info('Paste image requested');

      const buffer = await this.readClipboardImage();
      if (!buffer) {
        return { success: false, error: 'No image in clipboard' };
      }

      const { absolute: imagesDir, relativePrefix } = this.resolveImagesDir();
      try {
        await fs.mkdir(imagesDir, { recursive: true, mode: 0o700 });
      } catch (error) {
        logger.error('Failed to create images directory:', error);
      }

      const filename = this.generateImageFilename();
      const pathValidation = this.validateImagePath(imagesDir, filename);
      if (!pathValidation.valid || !pathValidation.normalizedPath) {
        return { success: false, error: pathValidation.error || 'Invalid file path' };
      }

      await fs.writeFile(pathValidation.normalizedPath, buffer, { mode: 0o600 });
      // Use clear() not writeText('') — writeText only replaces the text type,
      // leaving image formats (TIFF/PNG/AVIF…) on NSPasteboard. Stale image
      // data prevents subsequent paste-from-clipboard calls from delivering
      // the prompt text.
      clipboard.clear();

      logger.info('Image saved successfully', { filepath: pathValidation.normalizedPath, relativePrefix });
      const result: { success: boolean; path: string; relativePath?: string } = { success: true, path: pathValidation.normalizedPath };
      if (relativePrefix) result.relativePath = path.join(relativePrefix, filename);
      return result;
    } catch (error) {
      // Internal messages must not cross the IPC boundary, as handlePasteText
      // already ensures for the same class of failure.
      logger.error('Failed to handle paste image:', error);
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  private async setClipboardAsync(text: string): Promise<void> {
    // The system clipboard is shared with everything the user is doing.
    if (isIsolatedInstance()) {
      logger.debug('Isolated instance: skipping clipboard write');
      return;
    }

    // No clear() first: Electron 44's writeText replaces the whole pasteboard
    // atomically (measured — an image/png entry is gone afterwards and
    // has('image/png') is false), so the stale-image problem the old sync API
    // had is solved by the write itself. Clearing separately would only mean
    // that a failed write leaves the user with an empty clipboard instead of
    // what they had before.
    //
    // The rejection is deliberately not swallowed. The caller hides the window
    // and fires Cmd+V immediately after this resolves, so reporting success on
    // a failed write would paste nothing while telling the user it worked; the
    // Promise.all in handlePasteText turns a throw into OPERATION_FAILED.
    // This bounds an unresolved Promise, not a synchronous main-thread block.
    // Electron exposes no cancellation: a late write may still update the
    // clipboard, but must never resume the failed paste operation.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Clipboard write timed out')), CLIPBOARD_WRITE_TIMEOUT_MS);
      });
      await Promise.race([clipboard.writeText(text), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async getPreviousAppAsync(): Promise<AppInfo | string | null> {
    try {
      return this.windowManager.getPreviousApp();
    } catch (error) {
      logger.warn('Failed to get previous app info:', error);
      return null;
    }
  }

  private showAccessibilityWarning(bundleId: string): void {
    // A modal from a background verification instance would steal the screen.
    if (isIsolatedInstance()) {
      logger.warn('Isolated instance: accessibility permission missing', { bundleId });
      return;
    }

    dialog.showMessageBox({
      type: 'warning',
      title: 'Accessibility Permission Required',
      message: 'Prompt Line needs accessibility permission to function properly.',
      detail: `To enable paste functionality:\n\n1. Open System Preferences\n2. Go to Security & Privacy → Privacy\n3. Select "Accessibility"\n4. Add "Prompt Line" and enable it\n\nBundle ID: ${bundleId}`,
      buttons: ['Open System Preferences', 'Set Up Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result: { response: number }) => {
      if (result.response === 0) {
        // Open System Preferences accessibility settings
        execFile('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility']);
      }
    }).catch((error: Error) => {
      logger.error('Failed to show accessibility warning dialog:', error);
    });
  }
}

export default PasteHandler;
