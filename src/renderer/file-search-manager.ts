/**
 * File Search Manager for renderer process
 * Manages @ file mention functionality with incremental search
 */

import type { FileInfo, DirectoryInfo, AgentItem } from '../types';

/**
 * Format object for console output (Electron renderer -> main process)
 * Outputs in a format similar to the main process logger
 */
function formatLog(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj)
    .map(([key, value]) => `  ${key}: ${typeof value === 'string' ? `'${value}'` : value}`)
    .join(',\n');
  return '{\n' + entries + '\n}';
}

// Directory data for file search (cached in renderer)
interface DirectoryData {
  directory: string;
  files: FileInfo[];
  timestamp: number;
  partial?: boolean;          // true for Stage 1 (quick), false for Stage 2 (recursive)
  searchMode?: 'quick' | 'recursive';
  usedFd?: boolean;           // true if fd command was used
}

interface FileSearchCallbacks {
  onFileSelected: (filePath: string) => void;
  getTextContent: () => string;
  setTextContent: (text: string) => void;
  getCursorPosition: () => number;
  setCursorPosition: (position: number) => void;
}

// Represents a tracked @path in the text
interface AtPathRange {
  start: number;  // Position of @
  end: number;    // Position after the last character of the path
}

export class FileSearchManager {
  private suggestionsContainer: HTMLElement | null = null;
  private textInput: HTMLTextAreaElement | null = null;
  private highlightBackdrop: HTMLDivElement | null = null;
  private cachedDirectoryData: DirectoryData | null = null;
  private selectedIndex: number = 0;
  private filteredFiles: FileInfo[] = [];
  private filteredAgents: AgentItem[] = []; // Agents matching the query
  private isVisible: boolean = false;
  private currentQuery: string = '';
  private atStartPosition: number = -1;
  private callbacks: FileSearchCallbacks;
  private currentPath: string = ''; // Current directory path being browsed (relative from root)
  private mirrorDiv: HTMLDivElement | null = null; // Hidden div for caret position calculation
  private atPaths: AtPathRange[] = []; // Tracked @paths in the text

  // Constants
  private static readonly MAX_SUGGESTIONS = 15;
  private static readonly MAX_AGENTS = 5; // Max agents to show in suggestions

  constructor(callbacks: FileSearchCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Calculate the pixel position of a character in the textarea
   * Uses a mirror div technique to measure text position
   */
  private getCaretCoordinates(position: number): { top: number; left: number } | null {
    if (!this.textInput) return null;

    // Create mirror div if it doesn't exist
    if (!this.mirrorDiv) {
      this.mirrorDiv = document.createElement('div');
      this.mirrorDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: hidden;
      `;
      document.body.appendChild(this.mirrorDiv);
    }

    // Copy textarea styles to mirror div
    const style = window.getComputedStyle(this.textInput);
    const properties = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'letterSpacing', 'textTransform', 'wordSpacing',
      'textIndent', 'whiteSpace', 'lineHeight',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'boxSizing', 'width'
    ];

    properties.forEach(prop => {
      const value = style.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
      if (value) {
        this.mirrorDiv!.style.setProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
      }
    });

    // Get text up to the position and add a span marker
    const text = this.textInput.value.substring(0, position);
    const textNode = document.createTextNode(text);
    const marker = document.createElement('span');
    marker.textContent = '@'; // Use @ as marker

    this.mirrorDiv.innerHTML = '';
    this.mirrorDiv.appendChild(textNode);
    this.mirrorDiv.appendChild(marker);

    // Get marker position relative to mirror div
    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = this.mirrorDiv.getBoundingClientRect();

    // Calculate position relative to textarea
    const textareaRect = this.textInput.getBoundingClientRect();

    return {
      top: markerRect.top - mirrorRect.top + textareaRect.top - this.textInput.scrollTop,
      left: markerRect.left - mirrorRect.left + textareaRect.left - this.textInput.scrollLeft
    };
  }

  public initializeElements(): void {
    this.textInput = document.getElementById('textInput') as HTMLTextAreaElement;
    this.highlightBackdrop = document.getElementById('highlightBackdrop') as HTMLDivElement;
    console.debug('[FileSearchManager] initializeElements: textInput found:', !!this.textInput, 'highlightBackdrop found:', !!this.highlightBackdrop);

    // Create suggestions container if it doesn't exist
    this.suggestionsContainer = document.getElementById('fileSuggestions');
    if (!this.suggestionsContainer) {
      this.suggestionsContainer = document.createElement('div');
      this.suggestionsContainer.id = 'fileSuggestions';
      this.suggestionsContainer.className = 'file-suggestions';
      this.suggestionsContainer.setAttribute('role', 'listbox');
      this.suggestionsContainer.setAttribute('aria-label', 'File suggestions');

      // Insert into main-content (allows suggestions to span across input-section and history-section)
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.appendChild(this.suggestionsContainer);
        console.debug('[FileSearchManager] initializeElements: suggestionsContainer created and appended to main-content');
      } else {
        console.warn('[FileSearchManager] initializeElements: .main-content not found!');
      }
    } else {
      console.debug('[FileSearchManager] initializeElements: suggestionsContainer already exists');
    }
  }

  public setupEventListeners(): void {
    if (!this.textInput) {
      console.warn('[FileSearchManager] setupEventListeners: textInput is null, skipping');
      return;
    }

    console.debug('[FileSearchManager] setupEventListeners: setting up event listeners');

    // Listen for input changes to detect @ mentions and update highlights
    this.textInput.addEventListener('input', () => {
      console.debug('[FileSearchManager] input event fired');
      this.checkForFileSearch();
      this.updateHighlightBackdrop();
    });

    // Listen for keydown for navigation and backspace handling
    this.textInput.addEventListener('keydown', (e) => {
      if (this.isVisible) {
        this.handleKeyDown(e);
      } else if (e.key === 'Backspace') {
        // Handle backspace to delete entire @path if cursor is at the end of one
        this.handleBackspaceForAtPath(e);
      }
    });

    // Sync scroll position between textarea and backdrop
    this.textInput.addEventListener('scroll', () => {
      this.syncBackdropScroll();
    });

    // Hide suggestions on blur (with small delay to allow click selection)
    this.textInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.suggestionsContainer?.contains(document.activeElement)) {
          this.hideSuggestions();
        }
      }, 150);
    });

    // Handle click outside
    document.addEventListener('click', (e) => {
      if (this.isVisible &&
          !this.suggestionsContainer?.contains(e.target as Node) &&
          !this.textInput?.contains(e.target as Node)) {
        this.hideSuggestions();
      }
    });
  }

  /**
   * Cache directory data from window-shown event (Stage 1 or Stage 2)
   */
  public cacheDirectoryData(data: DirectoryInfo | DirectoryData): void {
    if (!data || !data.directory) return;

    this.cachedDirectoryData = {
      directory: data.directory,
      files: data.files || [],
      timestamp: Date.now(),
      ...(data.partial !== undefined ? { partial: data.partial } : {}),
      ...(data.searchMode !== undefined ? { searchMode: data.searchMode } : {}),
      ...(data.usedFd !== undefined ? { usedFd: data.usedFd } : {})
    };

    console.debug('[FileSearchManager] Cached directory data:', formatLog({
      directory: data.directory,
      fileCount: data.files?.length || 0,
      searchMode: data.searchMode,
      partial: data.partial
    }));
  }

  /**
   * Update cache with new data (used for Stage 2 background update)
   */
  public updateCache(data: DirectoryInfo | DirectoryData): void {
    if (!data || !data.directory) return;

    // Only update if it's for the same directory and is more complete
    if (this.cachedDirectoryData?.directory === data.directory) {
      if (!data.partial || !this.cachedDirectoryData.partial) {
        this.cachedDirectoryData = {
          directory: data.directory,
          files: data.files || [],
          timestamp: Date.now(),
          ...(data.partial !== undefined ? { partial: data.partial } : {}),
          ...(data.searchMode !== undefined ? { searchMode: data.searchMode } : {}),
          ...(data.usedFd !== undefined ? { usedFd: data.usedFd } : {})
        };

        console.debug('[FileSearchManager] Updated cache with Stage 2 data:', formatLog({
          directory: data.directory,
          fileCount: data.files?.length || 0,
          searchMode: data.searchMode,
          usedFd: data.usedFd
        }));

        // If suggestions are visible, refresh them with new data
        if (this.isVisible && this.currentQuery) {
          this.showSuggestions(this.currentQuery);
        }
      }
    } else {
      // Different directory, replace cache
      this.cacheDirectoryData(data);
    }
  }

  /**
   * Clear the cached directory data
   */
  public clearCache(): void {
    this.cachedDirectoryData = null;
    this.hideSuggestions();
  }

  /**
   * Check if file search should be triggered based on cursor position
   */
  public checkForFileSearch(): void {
    console.debug('[FileSearchManager] checkForFileSearch called', formatLog({
      hasTextInput: !!this.textInput,
      hasCachedData: !!this.cachedDirectoryData,
      cachedDirectory: this.cachedDirectoryData?.directory,
      cachedFileCount: this.cachedDirectoryData?.files?.length
    }));

    if (!this.textInput || !this.cachedDirectoryData) {
      console.debug('[FileSearchManager] checkForFileSearch: early return - missing textInput or cachedDirectoryData');
      return;
    }

    const result = this.extractQueryAtCursor();
    console.debug('[FileSearchManager] extractQueryAtCursor result:', result ? formatLog(result as Record<string, unknown>) : 'null');

    if (result) {
      this.atStartPosition = result.startPos;
      this.currentQuery = result.query;
      console.debug('[FileSearchManager] showing suggestions for query:', result.query);
      this.showSuggestions(result.query);
    } else {
      this.hideSuggestions();
    }
  }

  /**
   * Extract the @ query at the current cursor position
   * Returns null if no valid @ pattern is found
   */
  public extractQueryAtCursor(): { query: string; startPos: number } | null {
    if (!this.textInput) return null;

    const text = this.textInput.value;
    const cursorPos = this.textInput.selectionStart;

    // Find the @ before cursor
    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];

      // Stop at whitespace or newline
      if (char === ' ' || char === '\n' || char === '\t') {
        break;
      }

      // Found @
      if (char === '@') {
        atPos = i;
        break;
      }
    }

    if (atPos === -1) return null;

    // Check that @ is at start of line or after whitespace
    if (atPos > 0) {
      const prevChar = text[atPos - 1];
      if (prevChar !== ' ' && prevChar !== '\n' && prevChar !== '\t') {
        return null; // @ is part of something else (like email)
      }
    }

    // Extract query (text after @ up to cursor)
    const query = text.substring(atPos + 1, cursorPos);

    return { query, startPos: atPos };
  }

  /**
   * Show file suggestions based on the query
   */
  public async showSuggestions(query: string): Promise<void> {
    console.debug('[FileSearchManager] showSuggestions called', formatLog({
      query,
      currentPath: this.currentPath,
      hasSuggestionsContainer: !!this.suggestionsContainer,
      hasCachedData: !!this.cachedDirectoryData
    }));

    if (!this.suggestionsContainer) {
      console.debug('[FileSearchManager] showSuggestions: early return - missing container');
      return;
    }

    // Adjust currentPath based on query
    // If query doesn't start with currentPath, navigate up to the matching level
    this.adjustCurrentPathToQuery(query);

    // Extract search term (part after currentPath)
    const searchTerm = this.currentPath ? query.substring(this.currentPath.length) : query;

    this.currentQuery = searchTerm;

    // Fetch agents matching the query (only at root level without path navigation)
    if (!this.currentPath) {
      this.filteredAgents = await this.searchAgents(searchTerm);
    } else {
      this.filteredAgents = [];
    }

    // Filter files if directory data is available
    if (this.cachedDirectoryData) {
      this.filteredFiles = this.filterFiles(searchTerm);
    } else {
      this.filteredFiles = [];
    }

    this.selectedIndex = 0;
    this.isVisible = true;

    console.debug('[FileSearchManager] showSuggestions: filtered', formatLog({
      agents: this.filteredAgents.length,
      files: this.filteredFiles.length,
      searchTerm
    }));
    this.renderSuggestions();
    this.positionSuggestions();
    this.updateSelection();
    console.debug('[FileSearchManager] showSuggestions: render complete, isVisible:', this.isVisible);
  }

  /**
   * Search agents via IPC
   */
  private async searchAgents(query: string): Promise<AgentItem[]> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.agents?.get) {
        const agents = await electronAPI.agents.get(query);
        return agents.slice(0, FileSearchManager.MAX_AGENTS);
      }
    } catch (error) {
      console.error('[FileSearchManager] Failed to search agents:', error);
    }
    return [];
  }

  /**
   * Adjust currentPath to match the query
   * If query is shorter than currentPath, navigate up to the matching level
   */
  private adjustCurrentPathToQuery(query: string): void {
    if (!this.currentPath) return;

    // If query starts with currentPath, we're searching within the current directory
    if (query.startsWith(this.currentPath)) {
      return;
    }

    // Query doesn't match currentPath, need to navigate up
    // Find the longest common prefix that ends with /
    let newPath = '';
    const parts = this.currentPath.split('/').filter(p => p);

    for (let i = 0; i < parts.length; i++) {
      const testPath = parts.slice(0, i + 1).join('/') + '/';
      if (query.startsWith(testPath)) {
        newPath = testPath;
      } else {
        break;
      }
    }

    if (newPath !== this.currentPath) {
      console.debug('[FileSearchManager] adjustCurrentPathToQuery: navigating up', formatLog({
        from: this.currentPath,
        to: newPath,
        query
      }));
      this.currentPath = newPath;
    }
  }

  /**
   * Position the suggestions container near the @ position
   * Shows above the cursor if there's not enough space below
   * Dynamically adjusts max-height based on available space
   * Uses main-content as positioning reference to allow spanning across input and history sections
   */
  private positionSuggestions(): void {
    if (!this.suggestionsContainer || !this.textInput || this.atStartPosition < 0) return;

    const coords = this.getCaretCoordinates(this.atStartPosition);
    if (!coords) return;

    // Get main-content for relative positioning (allows spanning across sections)
    const mainContent = this.textInput.closest('.main-content');
    if (!mainContent) return;

    const mainContentRect = mainContent.getBoundingClientRect();
    const lineHeight = parseInt(window.getComputedStyle(this.textInput).lineHeight) || 20;

    // Calculate position relative to main-content
    const caretTop = coords.top - mainContentRect.top;
    const left = Math.max(8, coords.left - mainContentRect.left);

    // Calculate available space below and above the cursor
    const spaceBelow = mainContentRect.height - (caretTop + lineHeight) - 8; // 8px margin
    const spaceAbove = caretTop - 8; // 8px margin

    let top: number = 0;
    let showAbove = false;
    let availableHeight: number;

    // Decide whether to show above or below based on available space
    if (spaceBelow >= spaceAbove) {
      // Show below the cursor - use all available space below
      top = caretTop + lineHeight + 4;
      availableHeight = spaceBelow;
    } else {
      // Show above the cursor - use all available space above
      showAbove = true;
      availableHeight = spaceAbove;
      // top will be calculated after setting max-height
    }

    // Set dynamic max-height based on available space (minimum 100px)
    const dynamicMaxHeight = Math.max(100, availableHeight);
    this.suggestionsContainer.style.maxHeight = `${dynamicMaxHeight}px`;

    // If showing above, calculate top position based on actual/expected height
    if (showAbove) {
      const menuHeight = Math.min(this.suggestionsContainer.scrollHeight || dynamicMaxHeight, dynamicMaxHeight);
      top = caretTop - menuHeight - 4;
      if (top < 0) top = 0;
    }

    // Calculate dynamic max-width based on available space from @ position to right edge
    // This allows the menu to span into the history section if needed
    const availableWidth = mainContentRect.width - left - 8; // 8px margin from right edge
    const dynamicMaxWidth = Math.max(300, availableWidth); // Minimum 300px width
    this.suggestionsContainer.style.maxWidth = `${dynamicMaxWidth}px`;

    this.suggestionsContainer.style.top = `${top}px`;
    this.suggestionsContainer.style.left = `${left}px`;
    this.suggestionsContainer.style.right = 'auto';
    this.suggestionsContainer.style.bottom = 'auto';

    console.debug('[FileSearchManager] positionSuggestions:', formatLog({
      atPosition: this.atStartPosition,
      top,
      left,
      showAbove,
      spaceBelow,
      spaceAbove,
      dynamicMaxHeight,
      dynamicMaxWidth
    }));
  }

  /**
   * Hide the suggestions dropdown
   */
  public hideSuggestions(): void {
    if (!this.suggestionsContainer) return;

    this.isVisible = false;
    this.suggestionsContainer.style.display = 'none';
    this.suggestionsContainer.innerHTML = '';
    this.filteredFiles = [];
    this.filteredAgents = []; // Clear agents as well
    this.currentQuery = '';
    this.atStartPosition = -1;
    this.currentPath = ''; // Reset directory navigation state
  }

  /**
   * Filter files based on query (fuzzy matching) and currentPath
   * When there's a query at root level, search recursively across all files
   */
  public filterFiles(query: string): FileInfo[] {
    if (!this.cachedDirectoryData?.files) return [];

    const baseDir = this.cachedDirectoryData.directory;
    const allFiles = this.cachedDirectoryData.files;
    let files: FileInfo[] = [];

    // If we're in a subdirectory, filter to show only direct children
    // Also create virtual directory entries for intermediate directories
    if (this.currentPath) {
      const seenDirs = new Set<string>();

      for (const file of allFiles) {
        const relativePath = this.getRelativePath(file.path, baseDir);

        // Check if file is under currentPath
        if (!relativePath.startsWith(this.currentPath)) {
          continue;
        }

        // Get the remaining path after currentPath
        const remainingPath = relativePath.substring(this.currentPath.length);
        if (!remainingPath) continue;

        const slashIndex = remainingPath.indexOf('/');

        if (slashIndex === -1) {
          // Direct file child
          files.push(file);
        } else if (slashIndex === remainingPath.length - 1) {
          // Direct directory child (already has trailing slash)
          if (!seenDirs.has(remainingPath)) {
            seenDirs.add(remainingPath);
            files.push(file);
          }
        } else {
          // Intermediate directory - create virtual entry
          const dirName = remainingPath.substring(0, slashIndex);
          if (!seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            // Create virtual directory entry
            const virtualDir: FileInfo = {
              name: dirName,
              path: baseDir + '/' + this.currentPath + dirName,
              isDirectory: true
            };
            files.push(virtualDir);
          }
        }
      }

      if (!query) {
        // Return first N files if no query, with directories first
        const sorted = [...files].sort((a, b) => {
          // Directories come first
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          // Then sort by name
          return a.name.localeCompare(b.name);
        });
        return sorted.slice(0, FileSearchManager.MAX_SUGGESTIONS);
      }

      const queryLower = query.toLowerCase();

      // Score and filter files
      const scored = files
        .map(file => ({
          file,
          score: this.calculateMatchScore(file, queryLower)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, FileSearchManager.MAX_SUGGESTIONS);

      return scored.map(item => item.file);
    }

    // At root level
    if (!query) {
      // No query - show top-level files and directories only
      const seenDirs = new Set<string>();

      for (const file of allFiles) {
        const relativePath = this.getRelativePath(file.path, baseDir);
        const slashIndex = relativePath.indexOf('/');

        if (slashIndex === -1) {
          // Top-level file
          files.push(file);
        } else {
          // Has subdirectory - create virtual directory for top-level
          const dirName = relativePath.substring(0, slashIndex);
          if (!seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            // Check if we already have this directory in allFiles
            const existingDir = allFiles.find(f =>
              f.isDirectory && this.getRelativePath(f.path, baseDir) === dirName
            );
            if (existingDir) {
              files.push(existingDir);
            } else {
              // Create virtual directory entry
              const virtualDir: FileInfo = {
                name: dirName,
                path: baseDir + '/' + dirName,
                isDirectory: true
              };
              files.push(virtualDir);
            }
          }
        }
      }

      // Return first N files if no query, with directories first
      const sorted = [...files].sort((a, b) => {
        // Directories come first
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        // Then sort by name
        return a.name.localeCompare(b.name);
      });
      return sorted.slice(0, FileSearchManager.MAX_SUGGESTIONS);
    }

    // With query at root level - search ALL files recursively and show matching ones
    // Also include matching directories
    const queryLower = query.toLowerCase();
    const seenDirs = new Set<string>();
    const matchingDirs: FileInfo[] = [];

    // First, find all matching files (from anywhere in the tree)
    const scoredFiles = allFiles
      .filter(file => !file.isDirectory)
      .map(file => ({
        file,
        score: this.calculateMatchScore(file, queryLower),
        relativePath: this.getRelativePath(file.path, baseDir)
      }))
      .filter(item => item.score > 0);

    // Also find matching directories (by path containing the query)
    for (const file of allFiles) {
      const relativePath = this.getRelativePath(file.path, baseDir);
      const pathParts = relativePath.split('/').filter(p => p);

      // Check each directory in the path (except the last part which is the file name)
      for (let i = 0; i < pathParts.length - 1; i++) {
        const dirPath = pathParts.slice(0, i + 1).join('/');
        const dirName = pathParts[i] || '';

        if (!dirName || seenDirs.has(dirPath)) continue;

        // Check if directory name or path matches query
        if (dirName.toLowerCase().includes(queryLower) || dirPath.toLowerCase().includes(queryLower)) {
          seenDirs.add(dirPath);
          const virtualDir: FileInfo = {
            name: dirName,
            path: baseDir + '/' + dirPath,
            isDirectory: true
          };
          matchingDirs.push(virtualDir);
        }
      }
    }

    // Score directories
    const scoredDirs = matchingDirs.map(dir => ({
      file: dir,
      score: this.calculateMatchScore(dir, queryLower),
      relativePath: this.getRelativePath(dir.path, baseDir)
    }));

    // Combine and sort by score
    const allScored = [...scoredFiles, ...scoredDirs]
      .sort((a, b) => b.score - a.score)
      .slice(0, FileSearchManager.MAX_SUGGESTIONS);

    return allScored.map(item => item.file);
  }

  /**
   * Calculate match score for a file
   * Higher score = better match
   */
  private calculateMatchScore(file: FileInfo, queryLower: string): number {
    const nameLower = file.name.toLowerCase();
    const pathLower = file.path.toLowerCase();

    let score = 0;

    // Exact name match
    if (nameLower === queryLower) {
      score += 1000;
    }
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) {
      score += 500;
    }
    // Name contains query
    else if (nameLower.includes(queryLower)) {
      score += 200;
    }
    // Path contains query
    else if (pathLower.includes(queryLower)) {
      score += 50;
    }
    // Fuzzy match on name
    else if (this.fuzzyMatch(nameLower, queryLower)) {
      score += 10;
    }

    // Bonus for files (not directories)
    if (!file.isDirectory) {
      score += 5;
    }

    // Bonus for shorter paths
    score += Math.max(0, 20 - pathLower.split('/').length);

    return score;
  }

  /**
   * Simple fuzzy matching
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    let patternIdx = 0;

    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        patternIdx++;
      }
    }

    return patternIdx === pattern.length;
  }

  /**
   * Count files in a directory (direct children only)
   */
  private countFilesInDirectory(dirPath: string): number {
    if (!this.cachedDirectoryData?.files) return 0;

    const baseDir = this.cachedDirectoryData.directory;
    const dirRelativePath = this.getRelativePath(dirPath, baseDir);
    const dirPrefix = dirRelativePath.endsWith('/') ? dirRelativePath : dirRelativePath + '/';

    let count = 0;
    const seenChildren = new Set<string>();

    for (const file of this.cachedDirectoryData.files) {
      const relativePath = this.getRelativePath(file.path, baseDir);

      if (!relativePath.startsWith(dirPrefix)) continue;

      const remainingPath = relativePath.substring(dirPrefix.length);
      if (!remainingPath) continue;

      // Get the direct child name
      const slashIndex = remainingPath.indexOf('/');
      const childName = slashIndex === -1 ? remainingPath : remainingPath.substring(0, slashIndex);

      if (!seenChildren.has(childName)) {
        seenChildren.add(childName);
        count++;
      }
    }

    return count;
  }

  /**
   * Get total count of items (agents + files) for navigation
   */
  private getTotalItemCount(): number {
    return this.filteredAgents.length + this.filteredFiles.length;
  }

  /**
   * Render the suggestions in the dropdown
   */
  private renderSuggestions(): void {
    if (!this.suggestionsContainer) return;

    const totalItems = this.getTotalItemCount();

    if (totalItems === 0) {
      this.suggestionsContainer.innerHTML = `
        <div class="file-suggestion-empty">
          No matching items found
        </div>
      `;
      this.suggestionsContainer.style.display = 'block';
      // Reset scroll position to top
      this.suggestionsContainer.scrollTop = 0;
      return;
    }

    // Reset scroll position to top when search text changes
    this.suggestionsContainer.scrollTop = 0;

    const fragment = document.createDocumentFragment();
    let itemIndex = 0;

    // Render agents section
    if (this.filteredAgents.length > 0) {
      const agentHeader = document.createElement('div');
      agentHeader.className = 'suggestion-section-header';
      agentHeader.textContent = 'Agents';
      fragment.appendChild(agentHeader);

      this.filteredAgents.forEach((agent) => {
        const item = document.createElement('div');
        item.className = 'file-suggestion-item agent-suggestion-item';
        item.setAttribute('role', 'option');
        item.setAttribute('data-index', itemIndex.toString());
        item.setAttribute('data-type', 'agent');
        item.setAttribute('data-agent-index', this.filteredAgents.indexOf(agent).toString());

        // Create icon
        const icon = document.createElement('span');
        icon.className = 'file-icon agent-icon';
        icon.textContent = '🤖';

        // Create name with highlighting
        const name = document.createElement('span');
        name.className = 'file-name agent-name';
        name.innerHTML = this.highlightMatch(agent.name, this.currentQuery);

        // Create description
        const desc = document.createElement('span');
        desc.className = 'file-path agent-description';
        desc.textContent = agent.description;

        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(desc);

        // Click handler
        const currentIndex = itemIndex;
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.selectItem(currentIndex);
        });

        // Mouse move handler
        item.addEventListener('mousemove', () => {
          const allItems = this.suggestionsContainer?.querySelectorAll('.file-suggestion-item');
          allItems?.forEach(el => el.classList.remove('hovered'));
          item.classList.add('hovered');
        });

        item.addEventListener('mouseleave', () => {
          item.classList.remove('hovered');
        });

        fragment.appendChild(item);
        itemIndex++;
      });
    }

    // Render files section
    if (this.filteredFiles.length > 0) {
      const baseDir = this.cachedDirectoryData?.directory || '';

      // Add section header if there are agents
      if (this.filteredAgents.length > 0) {
        const fileHeader = document.createElement('div');
        fileHeader.className = 'suggestion-section-header';
        fileHeader.textContent = 'Files';
        fragment.appendChild(fileHeader);
      }

      // Add path header if we're in a subdirectory
      if (this.currentPath) {
        const header = document.createElement('div');
        header.className = 'file-suggestion-header';
        header.textContent = this.currentPath;
        fragment.appendChild(header);
      }

      this.filteredFiles.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'file-suggestion-item';
        item.setAttribute('role', 'option');
        item.setAttribute('data-index', itemIndex.toString());
        item.setAttribute('data-type', 'file');
        item.setAttribute('data-file-index', this.filteredFiles.indexOf(file).toString());

        // Create icon
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = file.isDirectory ? '📁' : this.getFileIcon(file.name);

        // Create name with highlighting
        const name = document.createElement('span');
        name.className = 'file-name';

        if (file.isDirectory) {
          // For directories: show name with file count
          const fileCount = this.countFilesInDirectory(file.path);
          const displayName = this.highlightMatch(file.name, this.currentQuery);
          name.innerHTML = `${displayName} <span class="file-count">(${fileCount} files)</span>`;
        } else {
          // For files: just show the name
          name.innerHTML = this.highlightMatch(file.name, this.currentQuery);
        }

        item.appendChild(icon);
        item.appendChild(name);

        // Show the directory path next to the filename (for both files and directories)
        const relativePath = this.getRelativePath(file.path, baseDir);
        const dirPath = this.getDirectoryFromPath(relativePath);
        if (dirPath) {
          const pathEl = document.createElement('span');
          pathEl.className = 'file-path';
          pathEl.textContent = dirPath;
          item.appendChild(pathEl);
        }

        // Click handler
        const currentIndex = itemIndex;
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.selectItem(currentIndex);
        });

        // Mouse move handler - only highlight when mouse actually moves
        // This prevents accidental highlighting when menu appears under stationary mouse cursor
        item.addEventListener('mousemove', () => {
          // Remove hovered class from all items
          const allItems = this.suggestionsContainer?.querySelectorAll('.file-suggestion-item');
          allItems?.forEach(el => el.classList.remove('hovered'));
          // Add hovered class to this item
          item.classList.add('hovered');
        });

        // Remove hover when mouse leaves the item
        item.addEventListener('mouseleave', () => {
          item.classList.remove('hovered');
        });

        fragment.appendChild(item);
        itemIndex++;
      });
    }

    this.suggestionsContainer.innerHTML = '';
    this.suggestionsContainer.appendChild(fragment);
    this.suggestionsContainer.style.display = 'block';
  }

  /**
   * Select an item (agent or file) by combined index
   */
  private selectItem(index: number): void {
    if (index < this.filteredAgents.length) {
      // It's an agent
      this.selectAgent(index);
    } else {
      // It's a file
      const fileIndex = index - this.filteredAgents.length;
      this.selectFile(fileIndex);
    }
  }

  /**
   * Get directory path from a file path (excluding the filename)
   */
  private getDirectoryFromPath(relativePath: string): string {
    const lastSlash = relativePath.lastIndexOf('/');
    if (lastSlash === -1) return '';
    return relativePath.substring(0, lastSlash + 1); // Include trailing slash
  }

  /**
   * Get file icon based on extension
   */
  private getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    const iconMap: Record<string, string> = {
      'ts': '📘',
      'tsx': '⚛️',
      'js': '📒',
      'jsx': '⚛️',
      'json': '📋',
      'md': '📝',
      'html': '🌐',
      'css': '🎨',
      'scss': '🎨',
      'py': '🐍',
      'rb': '💎',
      'go': '🐹',
      'rs': '🦀',
      'swift': '🍎',
      'java': '☕',
      'kt': '🎯',
      'yml': '⚙️',
      'yaml': '⚙️',
      'sh': '🖥️',
      'bash': '🖥️',
      'zsh': '🖥️',
      'sql': '🗃️',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'svg': '🎭'
    };

    return iconMap[ext] || '📄';
  }

  /**
   * Highlight matching text
   */
  private highlightMatch(text: string, query: string): string {
    if (!query) return this.escapeHtml(text);

    const escaped = this.escapeHtml(text);
    const queryEscaped = this.escapeHtml(query);
    const regex = new RegExp(`(${queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

    return escaped.replace(regex, '<span class="highlight">$1</span>');
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get relative path from base directory
   */
  private getRelativePath(fullPath: string, baseDir: string): string {
    if (fullPath.startsWith(baseDir)) {
      const relative = fullPath.substring(baseDir.length);
      return relative.startsWith('/') ? relative.substring(1) : relative;
    }
    return fullPath;
  }

  /**
   * Handle keyboard navigation
   * Supports: ArrowDown/Ctrl+n/Ctrl+j (next), ArrowUp/Ctrl+p/Ctrl+k (previous), Enter/Tab (select), Escape (close)
   */
  public handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    const totalItems = this.getTotalItemCount();

    // Ctrl+n or Ctrl+j: Move down (same as ArrowDown)
    if (e.ctrlKey && (e.key === 'n' || e.key === 'j')) {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.min(this.selectedIndex + 1, totalItems - 1);
      this.updateSelection();
      return;
    }

    // Ctrl+p or Ctrl+k: Move up (same as ArrowUp)
    if (e.ctrlKey && (e.key === 'p' || e.key === 'k')) {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateSelection();
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.min(this.selectedIndex + 1, totalItems - 1);
        this.updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        break;

      case 'Enter':
        // Enter: Select the currently highlighted item (agent or file)
        if (totalItems > 0) {
          e.preventDefault();
          e.stopPropagation();
          this.selectItem(this.selectedIndex);
        }
        break;

      case 'Tab':
        // Tab: Navigate into directory (for files), or select item (for agents/files)
        if (totalItems > 0) {
          e.preventDefault();
          e.stopPropagation();

          // Check if current selection is a file (directory navigation)
          if (this.selectedIndex >= this.filteredAgents.length) {
            const fileIndex = this.selectedIndex - this.filteredAgents.length;
            const file = this.filteredFiles[fileIndex];
            if (file?.isDirectory) {
              // Navigate into directory
              this.navigateIntoDirectory(file);
              return;
            }
          }

          // Otherwise select the item (agent or file)
          this.selectItem(this.selectedIndex);
        }
        break;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.hideSuggestions();
        break;
    }
  }

  /**
   * Update visual selection state
   */
  private updateSelection(): void {
    if (!this.suggestionsContainer) return;

    const items = this.suggestionsContainer.querySelectorAll('.file-suggestion-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
        item.setAttribute('aria-selected', 'true');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
        item.setAttribute('aria-selected', 'false');
      }
    });
  }

  /**
   * Navigate into a directory (for Tab key on directories)
   */
  private navigateIntoDirectory(directory: FileInfo): void {
    if (!directory.isDirectory || !this.cachedDirectoryData) return;

    const baseDir = this.cachedDirectoryData.directory;
    const relativePath = this.getRelativePath(directory.path, baseDir);

    // Update current path to the selected directory
    this.currentPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';

    console.debug('[FileSearchManager] navigateIntoDirectory:', formatLog({
      directory: directory.name,
      currentPath: this.currentPath
    }));

    // Update the text input to show the current path after @
    this.updateTextInputWithPath(this.currentPath);

    // Clear the query and show files in the new directory
    this.currentQuery = '';
    this.selectedIndex = 0;
    this.filteredFiles = this.filterFiles('');
    this.renderSuggestions();
    this.updateSelection();
  }

  /**
   * Update text input with the current path (keeps @ and updates the path after it)
   */
  private updateTextInputWithPath(path: string): void {
    if (this.atStartPosition < 0) return;

    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Replace text after @ with the new path
    const before = text.substring(0, this.atStartPosition + 1); // Keep @
    const after = text.substring(cursorPos);
    const newText = before + path + after;

    this.callbacks.setTextContent(newText);

    // Position cursor at end of path (after @path)
    const newCursorPos = this.atStartPosition + 1 + path.length;
    this.callbacks.setCursorPosition(newCursorPos);
  }

  /**
   * Select a file and insert its path
   */
  public selectFile(index: number): void {
    const file = this.filteredFiles[index];
    if (!file) return;

    // Get relative path from base directory
    const baseDir = this.cachedDirectoryData?.directory || '';
    const relativePath = this.getRelativePath(file.path, baseDir);

    this.insertFilePath(relativePath);
    this.hideSuggestions();

    // Callback for external handling
    this.callbacks.onFileSelected(relativePath);
  }

  /**
   * Select an agent and insert its name with @ prefix
   */
  private selectAgent(index: number): void {
    const agent = this.filteredAgents[index];
    if (!agent) return;

    // Insert agent name (the name already serves as the identifier)
    this.insertFilePath(agent.name);
    this.hideSuggestions();

    // Callback for external handling (using agent name as path)
    this.callbacks.onFileSelected(`@${agent.name}`);
  }

  /**
   * Insert file path, keeping the @ and replacing only the query part
   */
  public insertFilePath(path: string): void {
    if (this.atStartPosition < 0) return;

    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Keep @ and replace only the query part with the path
    const before = text.substring(0, this.atStartPosition + 1); // Include @
    const after = text.substring(cursorPos);
    const newText = before + path + after;

    this.callbacks.setTextContent(newText);

    // Position cursor at end of inserted path (after @path)
    const newCursorPos = this.atStartPosition + 1 + path.length;
    this.callbacks.setCursorPosition(newCursorPos);

    // Add space after the path for better UX
    const textWithSpace = newText.substring(0, newCursorPos) + ' ' + newText.substring(newCursorPos);
    this.callbacks.setTextContent(textWithSpace);
    this.callbacks.setCursorPosition(newCursorPos + 1);

    // Track the @path range (including the space)
    this.addAtPath(this.atStartPosition, newCursorPos);

    // Update highlight backdrop
    this.updateHighlightBackdrop();

    // Reset state
    this.atStartPosition = -1;
  }

  /**
   * Add an @path range to the tracking list
   */
  private addAtPath(start: number, end: number): void {
    // Remove any overlapping paths
    this.atPaths = this.atPaths.filter(p => p.end <= start || p.start >= end);

    // Add the new path
    this.atPaths.push({ start, end });

    // Sort by start position
    this.atPaths.sort((a, b) => a.start - b.start);

    console.debug('[FileSearchManager] addAtPath:', formatLog({ start, end, totalPaths: this.atPaths.length }));
  }

  /**
   * Find @path at or just before the cursor position
   */
  private findAtPathAtCursor(cursorPos: number): AtPathRange | null {
    // Check if cursor is at the end of any @path (including one character after for space)
    for (const path of this.atPaths) {
      if (cursorPos === path.end || cursorPos === path.end + 1) {
        return path;
      }
    }
    return null;
  }

  /**
   * Handle backspace key to delete entire @path if cursor is at the end
   */
  private handleBackspaceForAtPath(e: KeyboardEvent): void {
    const cursorPos = this.callbacks.getCursorPosition();
    const atPath = this.findAtPathAtCursor(cursorPos);

    if (atPath) {
      e.preventDefault();

      const text = this.callbacks.getTextContent();

      // Delete the @path (and trailing space if present)
      let deleteEnd = atPath.end;
      if (text[deleteEnd] === ' ') {
        deleteEnd++;
      }

      const newText = text.substring(0, atPath.start) + text.substring(deleteEnd);
      this.callbacks.setTextContent(newText);
      this.callbacks.setCursorPosition(atPath.start);

      // Remove the path from tracking
      this.atPaths = this.atPaths.filter(p => p !== atPath);

      // Adjust positions of remaining paths
      const deletedLength = deleteEnd - atPath.start;
      this.atPaths = this.atPaths.map(p => {
        if (p.start > atPath.start) {
          return {
            start: p.start - deletedLength,
            end: p.end - deletedLength
          };
        }
        return p;
      });

      // Update highlight backdrop
      this.updateHighlightBackdrop();

      console.debug('[FileSearchManager] deleted @path:', formatLog({
        deletedStart: atPath.start,
        deletedEnd: deleteEnd,
        remainingPaths: this.atPaths.length
      }));
    }
  }

  /**
   * Sync the scroll position of the highlight backdrop with the textarea
   */
  private syncBackdropScroll(): void {
    if (this.textInput && this.highlightBackdrop) {
      this.highlightBackdrop.scrollTop = this.textInput.scrollTop;
      this.highlightBackdrop.scrollLeft = this.textInput.scrollLeft;
    }
  }

  /**
   * Update the highlight backdrop to show @path highlights
   */
  public updateHighlightBackdrop(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths in the text (in case user edited)
    this.rescanAtPaths(text);

    if (this.atPaths.length === 0) {
      // No @paths, just mirror the text
      this.highlightBackdrop.textContent = text;
      return;
    }

    // Build highlighted content
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const atPath of this.atPaths) {
      // Add text before this @path
      if (atPath.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, atPath.start)));
      }

      // Add highlighted @path
      const span = document.createElement('span');
      span.className = 'at-path-highlight';
      span.textContent = text.substring(atPath.start, atPath.end);
      fragment.appendChild(span);

      lastEnd = atPath.end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    this.highlightBackdrop.innerHTML = '';
    this.highlightBackdrop.appendChild(fragment);

    // Sync scroll
    this.syncBackdropScroll();
  }

  /**
   * Re-scan text for @paths (validates existing paths and finds new ones)
   * Only highlights @paths that were explicitly selected from the file suggestions,
   * not ones that are currently being typed/searched.
   */
  private rescanAtPaths(text: string): void {
    // Validate existing tracked paths
    this.atPaths = this.atPaths.filter(path => {
      // Check if the path still exists at this position
      if (path.start >= text.length) return false;
      if (text[path.start] !== '@') return false;

      // Check if path content looks like a file path
      const pathContent = text.substring(path.start + 1, path.end);
      if (!pathContent || pathContent.includes(' ') || pathContent.includes('\n')) return false;

      return true;
    });

    // NOTE: We do NOT auto-detect new @paths here.
    // Only paths that are explicitly selected from file suggestions (via selectFile/insertFilePath)
    // get added to atPaths. This prevents highlighting of partially typed @paths during search.

    // Sort by start position
    this.atPaths.sort((a, b) => a.start - b.start);
  }

  /**
   * Clear all tracked @paths (called when text is cleared)
   */
  public clearAtPaths(): void {
    this.atPaths = [];
    this.updateHighlightBackdrop();
  }

  /**
   * Check if suggestions are currently visible
   */
  public isActive(): boolean {
    return this.isVisible;
  }

  /**
   * Check if we have cached directory data
   */
  public hasCachedData(): boolean {
    return this.cachedDirectoryData !== null;
  }

  /**
   * Get the cached directory path
   */
  public getCachedDirectory(): string | null {
    return this.cachedDirectoryData?.directory || null;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.hideSuggestions();
    this.cachedDirectoryData = null;

    // Clean up mirror div
    if (this.mirrorDiv && this.mirrorDiv.parentNode) {
      this.mirrorDiv.parentNode.removeChild(this.mirrorDiv);
      this.mirrorDiv = null;
    }
  }
}
