/**
 * File Opener Manager - Handles file and URL opening operations
 *
 * Responsibilities:
 * - Opening files in editor with focus restoration
 * - Opening URLs in browser
 * - Handling Ctrl+Enter to open file/URL at cursor
 * - Handling Cmd+Click to open file/URL at cursor
 * - Removing @query text after file selection
 */

import {
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAtPathAtPosition,
  findAbsolutePathAtPosition,
  resolveAtPathToAbsolute
} from '../text-finder';

import {
  normalizePath,
  parsePathWithLineInfo
} from '../path-utils';

export interface FileOpenerCallbacks {
  // Called before opening file to suppress blur event
  onBeforeOpenFile?: () => void;

  // Enable/disable window dragging during file open
  setDraggable?: (enabled: boolean) => void;

  // Text content operations
  getTextContent: () => string;
  setTextContent: (text: string) => void;

  // Cursor position operations
  getCursorPosition: () => number;
  setCursorPosition: (position: number) => void;

  // Current directory for resolving relative paths
  getCurrentDirectory: () => string | null;

  // Window operations
  hideWindow?: () => void;
  restoreDefaultHint?: () => void;
}

/**
 * FileOpenerManager handles opening files and URLs with proper focus management
 */
export class FileOpenerManager {
  private callbacks: FileOpenerCallbacks;

  constructor(callbacks: FileOpenerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Open file in editor and enable draggable state
   * The opened file's application will be brought to foreground
   * @param filePath - Path to the file to open
   */
  async openFile(filePath: string): Promise<void> {
    try {
      this.callbacks.onBeforeOpenFile?.();
      // Enable draggable state while file is opening
      this.callbacks.setDraggable?.(true);
      await window.electronAPI.file.openInEditor(filePath);
      // Note: Do not restore focus to PromptLine window
      // The opened file's application should stay in foreground
    } catch (err) {
      console.error('Failed to open file in editor:', err);
      // Disable draggable state on error
      this.callbacks.setDraggable?.(false);
    }
  }

  /**
   * Open URL in external browser and restore focus to PromptLine window
   * Enables window dragging during URL open operation (same behavior as file open)
   * @param url - URL to open
   */
  async openUrl(url: string): Promise<void> {
    try {
      this.callbacks.onBeforeOpenFile?.();
      // Enable draggable state while URL is opening
      this.callbacks.setDraggable?.(true);
      const result = await window.electronAPI.shell.openExternal(url);
      if (!result.success) {
        console.error('Failed to open URL in browser:', result.error);
        // Disable draggable state on error
        this.callbacks.setDraggable?.(false);
      } else {
        console.log('URL opened successfully in browser:', url);
        // Restore focus to PromptLine window after a short delay
        // Keep draggable state enabled so user can move window while browser is open
        setTimeout(() => {
          window.electronAPI.window.focus().catch((err: Error) =>
            console.error('Failed to restore focus:', err)
          );
        }, 100);
      }
    } catch (err) {
      console.error('Failed to open URL in browser:', err);
      // Disable draggable state on error
      this.callbacks.setDraggable?.(false);
    }
  }

  /**
   * Handle Ctrl+Enter to open file or URL at cursor position
   * Priority order: URL → Slash Command → @path → Absolute Path
   */
  async handleCtrlEnter(e: KeyboardEvent): Promise<void> {
    const handled = await this.tryOpenItemAtCursor();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Handle Cmd+Click on @path, absolute path, or URL in textarea
   * Supports: URLs, file paths, agent names, and absolute paths (including ~)
   * Priority order: URL → Slash Command → @path → Absolute Path
   */
  async handleCmdClick(e: MouseEvent): Promise<void> {
    const handled = await this.tryOpenItemAtCursor();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Try to open URL, slash command, @path, or absolute path at cursor position
   * Priority order: URL → Slash Command → @path → Absolute Path
   * @returns true if something was opened, false otherwise
   */
  private async tryOpenItemAtCursor(): Promise<boolean> {
    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Check for URL first
    const url = findUrlAtPosition(text, cursorPos);
    if (url) {
      await this.openUrl(url.url);
      return true;
    }

    // Check for slash command (like /commit, /help)
    const slashCommand = findSlashCommandAtPosition(text, cursorPos);
    if (slashCommand) {
      try {
        const commandFilePath = await window.electronAPI.slashCommands.getFilePath(slashCommand.command);
        if (commandFilePath) {
          await this.openFile(commandFilePath);
          return true;
        }
      } catch (err) {
        console.error('Failed to resolve slash command file path:', err);
      }
      return true; // Still consumed the event even if failed
    }

    // Find @path at cursor position
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      await this.handleAtPath(atPath);
      return true;
    }

    // Find absolute path at cursor position
    const absolutePath = findAbsolutePathAtPosition(text, cursorPos);
    if (absolutePath) {
      await this.openFile(absolutePath);
      return true;
    }

    return false;
  }

  /**
   * Handle @path - try to resolve as file path or agent name
   * Priority: file path (if looks like path) → agent name → fallback to file path
   */
  private async handleAtPath(atPath: string): Promise<void> {
    // Check if it looks like a file path (contains / or . in the original input)
    const looksLikeFilePath = atPath.includes('/') || atPath.includes('.');

    if (looksLikeFilePath) {
      // Resolve as file path first
      const filePath = this.resolveRelativePath(atPath);
      if (filePath) {
        await this.openFile(filePath);
        return;
      }
    }

    // Try to resolve as agent name (for names like @backend-architect)
    try {
      const agentFilePath = await window.electronAPI.agents.getFilePath(atPath);
      if (agentFilePath) {
        await this.openFile(agentFilePath);
        return;
      }
    } catch (err) {
      console.error('Failed to resolve agent file path:', err);
    }

    // Fallback: try to open as file path if it wasn't already tried
    if (!looksLikeFilePath) {
      const filePath = this.resolveRelativePath(atPath);
      if (filePath) {
        await this.openFile(filePath);
      }
    }
  }

  /**
   * Resolve relative path to absolute path using current directory
   */
  private resolveRelativePath(relativePath: string): string | null {
    const currentDir = this.callbacks.getCurrentDirectory();
    return resolveAtPathToAbsolute(
      relativePath,
      currentDir ?? undefined,
      parsePathWithLineInfo,
      normalizePath
    );
  }

  /**
   * Remove the @query text from the textarea without inserting a file path
   * Used when opening a file with Ctrl+Enter from suggestions
   * @param atStartPosition - Start position of @ character
   */
  removeAtQueryText(atStartPosition: number): void {
    if (atStartPosition === -1) return;

    const currentText = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Calculate the end position of the @query (current cursor position)
    const endPosition = cursorPos;

    // Remove the @query text
    const before = currentText.slice(0, atStartPosition);
    const after = currentText.slice(endPosition);
    const newText = before + after;

    this.callbacks.setTextContent(newText);
    this.callbacks.setCursorPosition(atStartPosition);
  }
}
