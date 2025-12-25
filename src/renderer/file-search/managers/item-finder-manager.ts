/**
 * Item Finder Manager
 * Handles finding and opening URLs, slash commands, @paths, and absolute paths at cursor position
 */

import type { DirectoryData } from '..';
import {
  parsePathWithLineInfo,
  normalizePath,
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAbsolutePathAtPosition,
  resolveAtPathToAbsolute
} from '..';

export interface ItemFinderCallbacks {
  openUrl: (url: string) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  isCommandEnabledSync: () => boolean;
  getCachedDirectoryData: () => DirectoryData | null;
  getTextContent: () => string;
  getCursorPosition: () => number;
}

export class ItemFinderManager {
  private callbacks: ItemFinderCallbacks;

  constructor(callbacks: ItemFinderCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Find and open URL, slash command, @path, or absolute path at cursor position
   * @returns true if something was found and opened, false otherwise
   */
  public async findAndOpenItemAtCursor(): Promise<boolean> {
    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Check for URL first (highest priority)
    if (await this.tryOpenUrl(text, cursorPos)) {
      return true;
    }

    // Check for slash command (only if enabled)
    if (await this.tryOpenSlashCommand(text, cursorPos)) {
      return true;
    }

    // Check for @path (file path or agent name)
    if (await this.tryOpenAtPath(text, cursorPos)) {
      return true;
    }

    // Check for absolute path
    if (await this.tryOpenAbsolutePath(text, cursorPos)) {
      return true;
    }

    return false;
  }

  /**
   * Try to find and open URL at cursor position
   */
  private async tryOpenUrl(text: string, cursorPos: number): Promise<boolean> {
    const url = findUrlAtPosition(text, cursorPos);
    if (url) {
      await this.callbacks.openUrl(url.url);
      return true;
    }
    return false;
  }

  /**
   * Try to find and open slash command at cursor position
   */
  private async tryOpenSlashCommand(text: string, cursorPos: number): Promise<boolean> {
    if (!this.callbacks.isCommandEnabledSync()) {
      return false;
    }

    const slashCommand = findSlashCommandAtPosition(text, cursorPos);
    if (!slashCommand) {
      return false;
    }

    try {
      const commandFilePath = await window.electronAPI.slashCommands.getFilePath(slashCommand.command);
      if (commandFilePath) {
        await this.callbacks.openFile(commandFilePath);
        return true;
      }
    } catch (err) {
      console.error('Failed to resolve slash command file path:', err);
    }

    // Return true even on error to prevent event propagation
    return true;
  }

  /**
   * Try to find and open @path (file path or agent name) at cursor position
   */
  private async tryOpenAtPath(text: string, cursorPos: number): Promise<boolean> {
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (!atPath) {
      return false;
    }

    const looksLikeFilePath = this.looksLikeFilePath(atPath);

    // Try to resolve as file path first if it looks like one
    if (looksLikeFilePath) {
      if (await this.tryOpenAsFilePath(atPath)) {
        return true;
      }
    }

    // Try to resolve as agent name
    if (await this.tryOpenAsAgent(atPath)) {
      return true;
    }

    // Fallback: try to open as file path if it wasn't already tried
    if (!looksLikeFilePath) {
      if (await this.tryOpenAsFilePath(atPath)) {
        return true;
      }
    }

    // Return true even if nothing opened to prevent event propagation
    return true;
  }

  /**
   * Check if a path string looks like a file path
   */
  private looksLikeFilePath(path: string): boolean {
    return path.includes('/') || path.includes('.');
  }

  /**
   * Try to open @path as a file path
   */
  private async tryOpenAsFilePath(atPath: string): Promise<boolean> {
    const cachedData = this.callbacks.getCachedDirectoryData();
    const filePath = resolveAtPathToAbsolute(
      atPath,
      cachedData?.directory,
      parsePathWithLineInfo,
      normalizePath
    );

    if (filePath) {
      await this.callbacks.openFile(filePath);
      return true;
    }

    return false;
  }

  /**
   * Try to open @path as an agent name
   */
  private async tryOpenAsAgent(atPath: string): Promise<boolean> {
    try {
      const agentFilePath = await window.electronAPI.agents.getFilePath(atPath);
      if (agentFilePath) {
        await this.callbacks.openFile(agentFilePath);
        return true;
      }
    } catch (err) {
      console.error('Failed to resolve agent file path:', err);
    }

    return false;
  }

  /**
   * Try to find and open absolute path at cursor position
   */
  private async tryOpenAbsolutePath(text: string, cursorPos: number): Promise<boolean> {
    const absolutePath = findAbsolutePathAtPosition(text, cursorPos);
    if (absolutePath) {
      await this.callbacks.openFile(absolutePath);
      return true;
    }
    return false;
  }
}
