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

import { handleError } from '../../utils/error-handler';
import { electronAPI } from '../../services/electron-api';

import {
  findUrlAtPosition,
  findAgentSkillAtPosition,
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

  // Check if command type is enabled (for agent skills)
  isCommandEnabledSync?: () => boolean;

  // Window operations
  hideWindow?: () => void;
  restoreDefaultHint?: () => void;

  // Error notification
  showError?: (message: string) => void;

  // Agent skill support (for multi-word command detection)
  getKnownSkillNames?: () => string[];
}

/**
 * FileOpenerEventHandler handles opening files and URLs with proper focus management
 */
export class FileOpenerEventHandler {
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
      const result = await electronAPI.file.openInEditor(filePath);
      
      // Check for errors in the result
      if (!result.success && result.error) {
        this.callbacks.showError?.(result.error);
        this.callbacks.setDraggable?.(false);
        return;
      }
      // Note: Do not restore focus to PromptLine window
      // The opened file's application should stay in foreground
    } catch (err) {
      handleError('FileOpenerEventHandler.openFileInEditor', err);
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
      const result = await electronAPI.shell.openExternal(url);
      if (!result.success) {
        handleError('FileOpenerEventHandler.openUrl', new Error(result.error));
        // Disable draggable state on error
        this.callbacks.setDraggable?.(false);
      } else {
        // Restore focus to PromptLine window after a short delay
        // Keep draggable state enabled so user can move window while browser is open
        setTimeout(() => {
          electronAPI.window.focus().catch((err: Error) =>
            handleError('FileOpenerEventHandler.openUrl.restoreFocus', err)
          );
        }, 100);
      }
    } catch (err) {
      handleError('FileOpenerEventHandler.openUrl', err);
      // Disable draggable state on error
      this.callbacks.setDraggable?.(false);
    }
  }

  /**
   * Open the parent directory of a file in Finder
   * @param filePath - Path to the file whose directory to reveal
   */
  async revealInFinder(filePath: string): Promise<void> {
    try {
      this.callbacks.onBeforeOpenFile?.();
      this.callbacks.setDraggable?.(true);
      const result = await electronAPI.file.revealInFinder(filePath);

      if (!result.success && result.error) {
        this.callbacks.showError?.(result.error);
        this.callbacks.setDraggable?.(false);
        return;
      }
      // Restore focus to PromptLine window after a short delay
      setTimeout(() => {
        electronAPI.window.focus().catch((err: Error) =>
          handleError('FileOpenerEventHandler.revealInFinder.restoreFocus', err)
        );
      }, 100);
    } catch (err) {
      handleError('FileOpenerEventHandler.revealInFinder', err);
      this.callbacks.setDraggable?.(false);
    }
  }

  /**
   * Handle Ctrl+Enter to open file or URL at cursor position
   * Priority order: URL → Agent Skill → @path → Absolute Path
   */
  async handleCtrlEnter(e: KeyboardEvent): Promise<void> {
    const handled = await this.tryOpenItemAtCursor();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Handle Ctrl+Shift+Enter to reveal file's directory in Finder
   * Priority order: Agent Skill → @path → Absolute Path (URLs are skipped)
   */
  async handleCtrlShiftEnter(e: KeyboardEvent): Promise<void> {
    const handled = await this.tryRevealDirectoryAtCursor();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Handle Cmd+Click on @path, absolute path, or URL in textarea
   * Supports: URLs, file paths, agent names, and absolute paths (including ~)
   * Priority order: URL → Agent Skill → @path → Absolute Path
   */
  async handleCmdClick(e: MouseEvent): Promise<void> {
    // Wait for the browser to update cursor position after click
    // Using requestAnimationFrame ensures cursor position is updated
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

    const handled = await this.tryOpenItemAtCursor();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Try to open URL, agent skill, @path, or absolute path at cursor position
   * Priority order: URL → Agent Skill → @path → Absolute Path
   * @returns true if something was opened, false otherwise
   */
  private async tryOpenItemAtCursor(): Promise<boolean> {
    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();
    const knownSkillNames = this.callbacks.getKnownSkillNames?.();

    // Check for URL first
    const url = findUrlAtPosition(text, cursorPos);
    if (url) {
      await this.openUrl(url.url);
      return true;
    }

    // Check for agent skill (like /commit, /help, /Linear API)
    // Only user-defined commands have file paths; built-in commands return null
    const agentSkill = findAgentSkillAtPosition(text, cursorPos, knownSkillNames);
    if (agentSkill) {
      try {
        const commandFilePath = await electronAPI.agentSkills.getFilePath(agentSkill.command);
        if (commandFilePath) {
          await this.openFile(commandFilePath);
          return true;
        }
        // Built-in commands (no file path) - don't consume event, allow fallthrough
      } catch (err) {
        handleError('FileOpenerEventHandler.handleCtrlEnter.agentSkill', err);
      }
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
   * Try to reveal the directory of a file at cursor position in Finder
   * Priority order: Agent Skill → @path → Absolute Path (URLs are skipped)
   * @returns true if a directory was revealed, false otherwise
   */
  private async tryRevealDirectoryAtCursor(): Promise<boolean> {
    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();
    const knownSkillNames = this.callbacks.getKnownSkillNames?.();

    // Check for agent skill
    const agentSkill = findAgentSkillAtPosition(text, cursorPos, knownSkillNames);
    if (agentSkill) {
      try {
        const commandFilePath = await electronAPI.agentSkills.getFilePath(agentSkill.command);
        if (commandFilePath) {
          await this.revealInFinder(commandFilePath);
          return true;
        }
      } catch (err) {
        handleError('FileOpenerEventHandler.tryRevealDirectoryAtCursor.agentSkill', err);
      }
    }

    // Find @path at cursor position
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      const filePath = this.resolveRelativePath(atPath);
      if (filePath) {
        await this.revealInFinder(filePath);
        return true;
      }
      // Try agent file path
      try {
        const agentFilePath = await electronAPI.agents.getFilePath(atPath);
        if (agentFilePath) {
          await this.revealInFinder(agentFilePath);
          return true;
        }
      } catch (err) {
        handleError('FileOpenerEventHandler.tryRevealDirectoryAtCursor.agent', err);
      }
    }

    // Find absolute path at cursor position
    const absolutePath = findAbsolutePathAtPosition(text, cursorPos);
    if (absolutePath) {
      await this.revealInFinder(absolutePath);
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
      const agentFilePath = await electronAPI.agents.getFilePath(atPath);
      if (agentFilePath) {
        await this.openFile(agentFilePath);
        return;
      }
    } catch (err) {
      handleError('FileOpenerEventHandler.handleAtPath.agent', err);
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
