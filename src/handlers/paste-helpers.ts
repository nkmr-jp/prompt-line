import { clipboard, dialog } from 'electron';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import path from 'path';
import config from '../config/app-config';
import { logger, SecureErrors } from '../utils/utils';
import type { AppInfo } from '../types';
import type WindowManager from '../managers/window-manager';

// Constants
export const MAX_PASTE_TEXT_LENGTH_BYTES = 1024 * 1024; // 1MB limit for paste text

/**
 * Validates paste input text
 */
export function validatePasteInput(text: string): { valid: boolean; error: string } | { valid: true } {
  if (typeof text !== 'string') {
    logger.warn('Invalid input type for paste text', { type: typeof text });
    return { valid: false, error: SecureErrors.INVALID_INPUT };
  }

  if (!text.trim()) {
    logger.debug('Empty text provided for paste');
    return { valid: false, error: SecureErrors.INVALID_INPUT };
  }

  if (Buffer.byteLength(text, 'utf8') > MAX_PASTE_TEXT_LENGTH_BYTES) {
    logger.warn('Text size exceeds limit', {
      size: Buffer.byteLength(text, 'utf8'),
      limit: MAX_PASTE_TEXT_LENGTH_BYTES
    });
    return { valid: false, error: SecureErrors.SIZE_LIMIT_EXCEEDED };
  }

  return { valid: true };
}

/**
 * Extracts app name from AppInfo or string
 */
export function extractAppName(previousApp: AppInfo | string | null): string | undefined {
  if (!previousApp) {
    return undefined;
  }

  if (typeof previousApp === 'string') {
    return previousApp;
  }

  return previousApp.name;
}

/**
 * Sets clipboard text asynchronously
 */
export async function setClipboardAsync(text: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      clipboard.writeText(text);
      resolve();
    } catch (error) {
      logger.warn('Clipboard write failed:', error);
      resolve();
    }
  });
}

/**
 * Gets previous app info asynchronously
 */
export async function getPreviousAppAsync(windowManager: WindowManager): Promise<AppInfo | string | null> {
  try {
    return windowManager.getPreviousApp();
  } catch (error) {
    logger.warn('Failed to get previous app info:', error);
    return null;
  }
}

/**
 * Shows accessibility permission warning dialog
 */
export function showAccessibilityWarning(bundleId: string): void {
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

/**
 * Ensures image directory exists
 */
export async function ensureImageDirectory(): Promise<void> {
  const imagesDir = config.paths.imagesDir;
  try {
    await fs.mkdir(imagesDir, { recursive: true, mode: 0o700 });
  } catch (error) {
    logger.error('Failed to create images directory:', error);
  }
}

/**
 * Generates image filename with timestamp
 */
export function generateImageFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}.png`;
}

/**
 * Validates image filename format
 */
export function validateImageFilename(filename: string): { valid: boolean; error: string } | { valid: true } {
  const SAFE_FILENAME_REGEX = /^[0-9_]+\.png$/;
  if (!SAFE_FILENAME_REGEX.test(filename)) {
    logger.error('Invalid filename generated', { filename });
    return { valid: false, error: 'Invalid filename' };
  }
  return { valid: true };
}

/**
 * Builds and validates image path to prevent traversal attacks
 */
export function buildAndValidateImagePath(imagesDir: string, filename: string): string | null {
  const filepath = path.join(imagesDir, filename);
  const normalizedPath = path.normalize(filepath);

  if (!normalizedPath.startsWith(path.normalize(imagesDir))) {
    logger.error('Attempted path traversal detected - potential security threat', {
      filepath,
      normalizedPath,
      timestamp: Date.now(),
      source: 'handlePasteImage'
    });
    return null;
  }

  const expectedDir = path.normalize(imagesDir);
  const actualDir = path.dirname(normalizedPath);
  if (actualDir !== expectedDir) {
    logger.error('Unexpected directory in path', {
      expected: expectedDir,
      actual: actualDir
    });
    return null;
  }

  return normalizedPath;
}

/**
 * Saves image to file system
 */
export async function saveImage(image: any, filepath: string): Promise<void> {
  const buffer = image.toPNG();
  await fs.writeFile(filepath, buffer, { mode: 0o600 });
}
