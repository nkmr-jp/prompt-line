import { ipcMain, clipboard, IpcMainInvokeEvent, dialog, shell } from 'electron';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import path from 'path';
import os from 'os';
import config from '../config/app-config';
import { 
  logger, 
  pasteWithNativeTool, 
  activateAndPasteWithNativeTool, 
  sleep,
  checkAccessibilityPermission 
} from '../utils/utils';
import type WindowManager from '../managers/window-manager';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type SettingsManager from '../managers/settings-manager';
import MdSearchLoader from '../managers/md-search-loader';
import FileOpenerManager from '../managers/file-opener-manager';
import type { AppInfo, WindowData, HistoryItem, IHistoryManager, SlashCommandItem, AgentItem } from '../types';

interface IPCResult {
  success: boolean;
  error?: string;
  warning?: string;
}

interface PasteResult extends IPCResult {
  warning?: string;
}

interface AppInfoResult {
  name: string;
  version: string;
  description: string;
  platform: string;
  electronVersion?: string;
  nodeVersion?: string;
  isDevelopment: boolean;
}

interface ConfigData {
  shortcuts: Record<string, string>;
  history: Record<string, unknown>;
  draft: Record<string, unknown>;
  timing: Record<string, unknown>;
  app: Record<string, unknown>;
  platform: Record<string, unknown>;
  [key: string]: unknown;
}

interface HandlerStats {
  totalHandlers: number;
  registeredHandlers: string[];
  timestamp: number;
}

interface ImageResult extends IPCResult {
  path?: string;
}

// Constants
const MAX_PASTE_TEXT_LENGTH_BYTES = 1024 * 1024; // 1MB limit for paste text
const VALID_CONFIG_SECTIONS = ['shortcuts', 'history', 'draft', 'timing', 'app', 'platform'];

class IPCHandlers {
  private windowManager: WindowManager;
  private historyManager: IHistoryManager;
  private draftManager: DraftManager;
  private directoryManager: DirectoryManager;
  private settingsManager: SettingsManager;
  private mdSearchLoader: MdSearchLoader;
  private fileOpenerManager: FileOpenerManager;

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
    this.mdSearchLoader = new MdSearchLoader();
    this.fileOpenerManager = new FileOpenerManager(settingsManager);

    // Initialize MdSearchLoader with settings
    const settings = this.settingsManager.getSettings();
    if (settings.mdSearch) {
      this.mdSearchLoader.updateConfig(settings.mdSearch);
      logger.info('MdSearch config updated from settings');
    }

    this.setupHandlers();
  }

  private setupHandlers(): void {
    ipcMain.handle('paste-text', this.handlePasteText.bind(this));
    ipcMain.handle('get-history', this.handleGetHistory.bind(this));
    ipcMain.handle('clear-history', this.handleClearHistory.bind(this));
    ipcMain.handle('remove-history-item', this.handleRemoveHistoryItem.bind(this));
    ipcMain.handle('search-history', this.handleSearchHistory.bind(this));
    ipcMain.handle('save-draft', this.handleSaveDraft.bind(this));
    ipcMain.handle('clear-draft', this.handleClearDraft.bind(this));
    ipcMain.handle('get-draft', this.handleGetDraft.bind(this));
    ipcMain.handle('set-draft-directory', this.handleSetDraftDirectory.bind(this));
    ipcMain.handle('get-draft-directory', this.handleGetDraftDirectory.bind(this));
    ipcMain.handle('hide-window', this.handleHideWindow.bind(this));
    ipcMain.handle('show-window', this.handleShowWindow.bind(this));
    ipcMain.handle('focus-window', this.handleFocusWindow.bind(this));
    ipcMain.handle('get-app-info', this.handleGetAppInfo.bind(this));
    ipcMain.handle('get-config', this.handleGetConfig.bind(this));
    ipcMain.handle('paste-image', this.handlePasteImage.bind(this));
    ipcMain.handle('open-settings', this.handleOpenSettings.bind(this));
    ipcMain.handle('get-slash-commands', this.handleGetSlashCommands.bind(this));
    ipcMain.handle('get-slash-command-file-path', this.handleGetSlashCommandFilePath.bind(this));
    ipcMain.handle('get-agents', this.handleGetAgents.bind(this));
    ipcMain.handle('get-agent-file-path', this.handleGetAgentFilePath.bind(this));
    ipcMain.handle('get-md-search-max-suggestions', this.handleGetMdSearchMaxSuggestions.bind(this));
    ipcMain.handle('get-md-search-prefixes', this.handleGetMdSearchPrefixes.bind(this));
    ipcMain.handle('open-file-in-editor', this.handleOpenFileInEditor.bind(this));
    ipcMain.handle('check-file-exists', this.handleCheckFileExists.bind(this));
    ipcMain.handle('open-external-url', this.handleOpenExternalUrl.bind(this));

    logger.info('IPC handlers set up successfully');
  }

  private async handlePasteText(_event: IpcMainInvokeEvent, text: string): Promise<PasteResult> {
    try {
      logger.info('Paste text requested', { length: text.length });

      // Validate input
      if (typeof text !== 'string') {
        return { success: false, error: 'Invalid text provided' };
      }

      if (!text.trim()) {
        return { success: false, error: 'Empty text provided' };
      }

      // Add reasonable length limit (1MB) to prevent DoS attacks
      // Use Buffer.byteLength for accurate byte-based limit instead of character count
      if (Buffer.byteLength(text, 'utf8') > MAX_PASTE_TEXT_LENGTH_BYTES) {
        return { success: false, error: 'Text too large (max 1MB)' };
      }


      // Get previous app info before hiding window
      const previousApp = await this.getPreviousAppAsync();

      // Extract app name for history
      let appName: string | undefined;
      if (previousApp) {
        if (typeof previousApp === 'string') {
          appName = previousApp;
        } else if (previousApp.name) {
          appName = previousApp.name;
        }
      }

      // Get directory from directory manager
      const directory = this.directoryManager.getDirectory() || undefined;

      await Promise.all([
        this.historyManager.addToHistory(text, appName, directory),
        this.draftManager.clearDraft(),
        this.setClipboardAsync(text)
      ]);

      const hideWindowPromise = this.windowManager.hideInputWindow();
      await hideWindowPromise;

      await sleep(Math.max(config.timing.windowHideDelay, 5));

      try {
        if (previousApp && config.platform.isMac) {
          await activateAndPasteWithNativeTool(previousApp);
          logger.info('Activate and paste operation completed successfully');
          return { success: true };
        } else if (config.platform.isMac) {
          const focusSuccess = await this.windowManager.focusPreviousApp();

          if (focusSuccess) {
            await sleep(config.timing.appFocusDelay);
            await pasteWithNativeTool();
            logger.info('Paste operation completed successfully');
            return { success: true };
          } else {
            await pasteWithNativeTool();
            logger.warn('Paste attempted without focus confirmation');
            return { success: true, warning: 'Could not focus previous application' };
          }
        } else {
          logger.warn('Auto-paste not supported on this platform');
          return { success: true, warning: 'Auto-paste not supported on this platform' };
        }
      } catch (pasteError) {
        logger.error('Paste operation failed:', pasteError);
        
        // Check accessibility permission after paste failure on macOS
        if (config.platform.isMac) {
          try {
            const { hasPermission, bundleId } = await checkAccessibilityPermission();
            
            if (!hasPermission) {
              logger.warn('Paste failed - accessibility permission not granted', { bundleId });
              this.showAccessibilityWarning(bundleId);
              return { success: false, error: 'Accessibility permission required. Please grant permission and try again.' };
            }
          } catch (accessibilityError) {
            logger.error('Failed to check accessibility permission after paste failure:', accessibilityError);
          }
        }
        
        return { success: false, error: (pasteError as Error).message };
      }
    } catch (error) {
      logger.error('Failed to handle paste text:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async setClipboardAsync(text: string): Promise<void> {
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

  private async getPreviousAppAsync(): Promise<AppInfo | string | null> {
    try {
      return this.windowManager.getPreviousApp();
    } catch (error) {
      logger.warn('Failed to get previous app info:', error);
      return null;
    }
  }

  private async handleGetHistory(_event: IpcMainInvokeEvent): Promise<HistoryItem[]> {
    try {
      const history = await this.historyManager.getHistory();
      logger.debug('History requested', { count: history.length });
      return history;
    } catch (error) {
      logger.error('Failed to get history:', error);
      return [];
    }
  }

  private async handleClearHistory(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    try {
      await this.historyManager.clearHistory();
      logger.info('History cleared via IPC');
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear history:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleRemoveHistoryItem(_event: IpcMainInvokeEvent, id: string): Promise<IPCResult> {
    try {
      // Validate ID format (must match generateId() output: lowercase alphanumeric)
      // NOTE: This regex is coupled with utils.generateId() - update both if ID format changes
      if (!id || typeof id !== 'string' || !id.match(/^[a-z0-9]+$/)) {
        logger.warn('Invalid history item ID format', { id });
        return { success: false, error: 'Invalid ID format' };
      }
      
      const removed = await this.historyManager.removeHistoryItem(id);
      logger.info('History item removal requested', { id, removed });
      return { success: removed };
    } catch (error) {
      logger.error('Failed to remove history item:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleSearchHistory(
    _event: IpcMainInvokeEvent, 
    query: string, 
    limit = 10
  ): Promise<HistoryItem[]> {
    try {
      const results = await this.historyManager.searchHistory(query, limit);
      logger.debug('History search requested', { query, results: results.length });
      return results;
    } catch (error) {
      logger.error('Failed to search history:', error);
      return [];
    }
  }


  private async handleSaveDraft(
    _event: IpcMainInvokeEvent, 
    text: string, 
    immediate = false
  ): Promise<IPCResult> {
    try {
      if (immediate) {
        await this.draftManager.saveDraftImmediately(text);
      } else {
        await this.draftManager.saveDraft(text);
      }

      logger.debug('Draft save requested', { length: text.length, immediate });
      return { success: true };
    } catch (error) {
      logger.error('Failed to save draft:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleClearDraft(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    try {
      await this.draftManager.clearDraft();
      logger.info('Draft cleared via IPC');
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear draft:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleGetDraft(_event: IpcMainInvokeEvent): Promise<string> {
    try {
      const draft = this.draftManager.getCurrentDraft();
      logger.debug('Draft requested', { length: draft.length });
      return draft;
    } catch (error) {
      logger.error('Failed to get draft:', error);
      return '';
    }
  }

  private async handleSetDraftDirectory(
    _event: IpcMainInvokeEvent,
    directory: string | null
  ): Promise<IPCResult> {
    try {
      if (directory) {
        await this.directoryManager.saveDirectory(directory);
      } else {
        this.directoryManager.setDirectory(null);
      }
      logger.debug('Directory set via IPC', { directory });
      return { success: true };
    } catch (error) {
      logger.error('Failed to set directory:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleGetDraftDirectory(_event: IpcMainInvokeEvent): Promise<string | null> {
    try {
      const directory = this.directoryManager.getDirectory();
      logger.debug('Directory requested', { directory });
      return directory;
    } catch (error) {
      logger.error('Failed to get directory:', error);
      return null;
    }
  }

  private async handleHideWindow(_event: IpcMainInvokeEvent, restoreFocus: boolean = true): Promise<IPCResult> {
    try {
      logger.debug('Window hide requested, restoreFocus:', restoreFocus);

      await this.windowManager.hideInputWindow();
      
      // Focus the previous app when hiding the window (only if restoreFocus is true)
      if (config.platform.isMac && restoreFocus) {
        try {
          // Wait for window hide animation to complete
          await sleep(config.timing.windowHideDelay || 150);
          
          // Attempt to focus previous app
          const focusSuccess = await this.windowManager.focusPreviousApp();
          
          if (!focusSuccess) {
            logger.warn('Failed to focus previous app via native tools - no fallback available for security reasons');
          } else {
            logger.debug('Successfully focused previous app');
          }
        } catch (focusError) {
          // Log but don't fail the operation if focus fails
          logger.warn('Failed to focus previous app:', focusError);
        }
      }
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to hide window:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleShowWindow(
    _event: IpcMainInvokeEvent,
    data: WindowData = {}
  ): Promise<IPCResult> {
    try {
      await this.windowManager.showInputWindow(data);
      logger.debug('Window show requested');
      return { success: true };
    } catch (error) {
      logger.error('Failed to show window:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleFocusWindow(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    try {
      this.windowManager.focusWindow();
      logger.debug('Window focus requested');
      return { success: true };
    } catch (error) {
      logger.error('Failed to focus window:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleGetAppInfo(_event: IpcMainInvokeEvent): Promise<AppInfoResult | {}> {
    try {
      const appInfo: AppInfoResult = {
        name: config.app.name,
        version: config.app.version,
        description: config.app.description,
        platform: process.platform,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        isDevelopment: config.isDevelopment()
      };

      logger.debug('App info requested');
      return appInfo;
    } catch (error) {
      logger.error('Failed to get app info:', error);
      return {};
    }
  }

  private async handleGetConfig(
    _event: IpcMainInvokeEvent, 
    section: string | null = null
  ): Promise<ConfigData | Record<string, unknown> | {}> {
    try {
      if (section) {
        // Validate section name against whitelist
        if (!VALID_CONFIG_SECTIONS.includes(section)) {
          logger.warn('Invalid config section requested', { section });
          return {};
        }
        
        const configData = config.get(section as keyof typeof config);
        logger.debug('Config section requested', { section });
        return configData;
      } else {
        const safeConfig: ConfigData = {
          shortcuts: config.shortcuts as unknown as Record<string, string>,
          history: config.history as unknown as Record<string, unknown>,
          draft: config.draft as unknown as Record<string, unknown>,
          timing: config.timing as unknown as Record<string, unknown>,
          app: config.app as unknown as Record<string, unknown>,
          platform: config.platform as unknown as Record<string, unknown>
        };

        logger.debug('Full config requested');
        return safeConfig;
      }
    } catch (error) {
      logger.error('Failed to get config:', error);
      return {};
    }
  }

  private async handlePasteImage(_event: IpcMainInvokeEvent): Promise<ImageResult> {
    try {
      logger.info('Paste image requested');

      const image = clipboard.readImage();
      
      if (image.isEmpty()) {
        return { success: false, error: 'No image in clipboard' };
      }

      const imagesDir = config.paths.imagesDir;
      try {
        await fs.mkdir(imagesDir, { recursive: true });
      } catch (error) {
        logger.error('Failed to create images directory:', error);
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      const filename = `${year}${month}${day}_${hours}${minutes}${seconds}.png`;
      const filepath = path.join(imagesDir, filename);
      
      // Normalize and validate path to prevent path traversal
      const normalizedPath = path.normalize(filepath);
      if (!normalizedPath.startsWith(path.normalize(imagesDir))) {
        logger.error('Attempted path traversal detected - potential security threat', { 
          filepath, 
          normalizedPath, 
          timestamp: Date.now(),
          source: 'handlePasteImage'
        });
        return { success: false, error: 'Invalid file path' };
      }

      const buffer = image.toPNG();
      await fs.writeFile(normalizedPath, buffer);

      // Clear clipboard text to prevent markdown syntax from being pasted
      // when copying images from markdown editors like Bear
      clipboard.writeText('');

      logger.info('Image saved successfully', { filepath: normalizedPath });

      return { success: true, path: filepath };
    } catch (error) {
      logger.error('Failed to handle paste image:', error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  private async handleOpenSettings(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    try {
      const settingsFilePath = this.settingsManager.getSettingsFilePath();
      logger.info('Opening settings file:', settingsFilePath);

      await shell.openPath(settingsFilePath);
      return { success: true };
    } catch (error) {
      logger.error('Failed to open settings file:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleGetSlashCommands(
    _event: IpcMainInvokeEvent,
    query?: string
  ): Promise<SlashCommandItem[]> {
    try {
      // Refresh config from settings in case they changed
      const settings = this.settingsManager.getSettings();
      this.mdSearchLoader.updateConfig(settings.mdSearch);

      // Get commands from MdSearchLoader
      const items = query
        ? await this.mdSearchLoader.searchItems('command', query)
        : await this.mdSearchLoader.getItems('command');

      // Convert MdSearchItem to SlashCommandItem for backward compatibility
      const commands: SlashCommandItem[] = items.map(item => {
        const cmd: SlashCommandItem = {
          name: item.name,
          description: item.description,
          filePath: item.filePath,
        };
        if (item.argumentHint) {
          cmd.argumentHint = item.argumentHint;
        }
        if (item.frontmatter) {
          cmd.frontmatter = item.frontmatter;
        }
        return cmd;
      });

      logger.debug('Slash commands requested', { query, count: commands.length });
      return commands;
    } catch (error) {
      logger.error('Failed to get slash commands:', error);
      return [];
    }
  }

  private async handleGetSlashCommandFilePath(
    _event: IpcMainInvokeEvent,
    commandName: string
  ): Promise<string | null> {
    try {
      if (!commandName || typeof commandName !== 'string') {
        return null;
      }

      // Refresh config from settings in case they changed
      const settings = this.settingsManager.getSettings();
      this.mdSearchLoader.updateConfig(settings.mdSearch);

      const items = await this.mdSearchLoader.getItems('command');
      const command = items.find(c => c.name === commandName);

      if (command) {
        logger.debug('Slash command file path resolved', { commandName, filePath: command.filePath });
        return command.filePath;
      }

      logger.debug('Slash command not found', { commandName });
      return null;
    } catch (error) {
      logger.error('Failed to get slash command file path:', error);
      return null;
    }
  }

  private async handleGetAgents(
    _event: IpcMainInvokeEvent,
    query?: string
  ): Promise<AgentItem[]> {
    try {
      // Refresh config from settings in case they changed
      const settings = this.settingsManager.getSettings();
      this.mdSearchLoader.updateConfig(settings.mdSearch);

      // Get mentions (agents) from MdSearchLoader
      // Always use searchItems to apply searchPrefix filtering, even for empty query
      const items = await this.mdSearchLoader.searchItems('mention', query ?? '');

      // Convert MdSearchItem to AgentItem for backward compatibility
      const agents: AgentItem[] = items.map(item => {
        const agent: AgentItem = {
          name: item.name,
          description: item.description,
          filePath: item.filePath,
        };
        if (item.frontmatter) {
          agent.frontmatter = item.frontmatter;
        }
        return agent;
      });

      logger.debug('Agents requested', { query, count: agents.length });
      return agents;
    } catch (error) {
      logger.error('Failed to get agents:', error);
      return [];
    }
  }

  private async handleGetAgentFilePath(
    _event: IpcMainInvokeEvent,
    agentName: string
  ): Promise<string | null> {
    try {
      if (!agentName || typeof agentName !== 'string') {
        return null;
      }

      // Refresh config from settings in case they changed
      const settings = this.settingsManager.getSettings();
      this.mdSearchLoader.updateConfig(settings.mdSearch);

      const items = await this.mdSearchLoader.getItems('mention');
      const agent = items.find(a => a.name === agentName);

      if (agent) {
        logger.debug('Agent file path resolved', { agentName, filePath: agent.filePath });
        return agent.filePath;
      }

      logger.debug('Agent not found', { agentName });
      return null;
    } catch (error) {
      logger.error('Failed to get agent file path:', error);
      return null;
    }
  }

  private handleGetMdSearchMaxSuggestions(
    _event: IpcMainInvokeEvent,
    type: 'command' | 'mention'
  ): number {
    try {
      // Refresh config from settings in case they changed
      const settings = this.settingsManager.getSettings();
      this.mdSearchLoader.updateConfig(settings.mdSearch);

      const maxSuggestions = this.mdSearchLoader.getMaxSuggestions(type);
      logger.debug('MdSearch maxSuggestions requested', { type, maxSuggestions });
      return maxSuggestions;
    } catch (error) {
      logger.error('Failed to get MdSearch maxSuggestions:', error);
      return 20; // Default fallback
    }
  }

  private handleGetMdSearchPrefixes(
    _event: IpcMainInvokeEvent,
    type: 'command' | 'mention'
  ): string[] {
    try {
      // Refresh config from settings in case they changed
      const settings = this.settingsManager.getSettings();
      this.mdSearchLoader.updateConfig(settings.mdSearch);

      const prefixes = this.mdSearchLoader.getSearchPrefixes(type);
      logger.debug('MdSearch searchPrefixes requested', { type, prefixes });
      return prefixes;
    } catch (error) {
      logger.error('Failed to get MdSearch searchPrefixes:', error);
      return []; // Default fallback
    }
  }

  private async handleOpenFileInEditor(
    _event: IpcMainInvokeEvent,
    filePath: string
  ): Promise<IPCResult> {
    try {
      logger.info('Opening file in editor:', { filePath });

      // Validate input
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'Invalid file path provided' };
      }

      // Expand ~ to home directory
      let expandedPath = filePath;
      if (filePath.startsWith('~/')) {
        expandedPath = path.join(os.homedir(), filePath.slice(2));
      } else if (filePath === '~') {
        expandedPath = os.homedir();
      }

      // Convert to absolute path if relative
      let absolutePath: string;
      if (path.isAbsolute(expandedPath)) {
        absolutePath = expandedPath;
      } else {
        // Use DirectoryManager's directory as base for relative paths
        const baseDir = this.directoryManager.getDirectory();
        if (baseDir) {
          absolutePath = path.join(baseDir, expandedPath);
        } else {
          // Fallback to process.cwd() if no directory is set
          absolutePath = path.join(process.cwd(), expandedPath);
        }
      }

      // Normalize and validate path to prevent path traversal
      const normalizedPath = path.normalize(absolutePath);

      logger.debug('Resolved file path:', {
        original: filePath,
        baseDir: this.directoryManager.getDirectory(),
        resolved: normalizedPath
      });

      // Open file using FileOpenerManager (respects user settings for app selection)
      return await this.fileOpenerManager.openFile(normalizedPath);
    } catch (error) {
      logger.error('Failed to open file in editor:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleCheckFileExists(
    _event: IpcMainInvokeEvent,
    filePath: string
  ): Promise<boolean> {
    try {
      // Validate input
      if (!filePath || typeof filePath !== 'string') {
        return false;
      }

      // Expand ~ to home directory
      let expandedPath = filePath;
      if (filePath.startsWith('~/')) {
        expandedPath = path.join(os.homedir(), filePath.slice(2));
      } else if (filePath === '~') {
        expandedPath = os.homedir();
      }

      // Convert to absolute path if relative
      let absolutePath: string;
      if (path.isAbsolute(expandedPath)) {
        absolutePath = expandedPath;
      } else {
        // Use DirectoryManager's directory as base for relative paths
        const baseDir = this.directoryManager.getDirectory();
        if (baseDir) {
          absolutePath = path.join(baseDir, expandedPath);
        } else {
          // Fallback to process.cwd() if no directory is set
          absolutePath = path.join(process.cwd(), expandedPath);
        }
      }

      // Normalize path
      const normalizedPath = path.normalize(absolutePath);

      // Check if file exists
      await fs.access(normalizedPath);
      return true;
    } catch {
      // File does not exist or cannot be accessed
      return false;
    }
  }

  private async handleOpenExternalUrl(
    _event: IpcMainInvokeEvent,
    url: string
  ): Promise<IPCResult> {
    try {
      logger.info('Opening external URL:', { url });

      // Validate input
      if (!url || typeof url !== 'string') {
        return { success: false, error: 'Invalid URL provided' };
      }

      // Validate URL format
      if (!url.match(/^https?:\/\//i)) {
        return { success: false, error: 'URL must start with http:// or https://' };
      }

      // Additional security: check for potentially dangerous URLs
      const urlLower = url.toLowerCase();
      if (urlLower.includes('file://') || urlLower.includes('javascript:')) {
        logger.warn('Attempted to open potentially dangerous URL:', { url });
        return { success: false, error: 'Invalid URL protocol' };
      }

      // Open URL with system default browser
      await shell.openExternal(url);

      logger.info('URL opened successfully in browser:', { url });
      return { success: true };
    } catch (error) {
      logger.error('Failed to open external URL:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  removeAllHandlers(): void {
    const handlers = [
      'paste-text',
      'get-history',
      'clear-history',
      'remove-history-item',
      'search-history',
      'save-draft',
      'clear-draft',
      'get-draft',
      'set-draft-directory',
      'get-draft-directory',
      'hide-window',
      'show-window',
      'focus-window',
      'get-app-info',
      'get-config',
      'paste-image',
      'open-settings',
      'get-slash-commands',
      'get-slash-command-file-path',
      'get-agents',
      'get-agent-file-path',
      'get-md-search-max-suggestions',
      'open-file-in-editor',
      'check-file-exists',
      'open-external-url'
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    logger.info('All IPC handlers removed');
  }

  getHandlerStats(): HandlerStats {
    const handlers = ipcMain.eventNames() as string[];
    return {
      totalHandlers: handlers.length,
      registeredHandlers: handlers,
      timestamp: Date.now()
    };
  }

  private showAccessibilityWarning(bundleId: string): void {
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

export default IPCHandlers;