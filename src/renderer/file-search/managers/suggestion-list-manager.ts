/**
 * SuggestionListManager - Manages suggestion dropdown display and interaction
 *
 * Responsibilities:
 * - Orchestrates suggestion dropdown components
 * - Manages suggestion list state and visibility
 * - Coordinates rendering, positioning, and event handling
 * - Delegates specialized tasks to focused managers
 */

import type { SuggestionItem } from '../types';
import type { FileInfo } from '../../../types';
import { SuggestionItemRenderer } from './suggestion-item-renderer';
import type { SuggestionItemRendererCallbacks } from './suggestion-item-renderer';
import { SuggestionPositionCalculator } from './suggestion-position-calculator';
import type { SuggestionPositionCallbacks } from './suggestion-position-calculator';
import { SuggestionEventHandler } from './suggestion-event-handler';
import type { SuggestionEventCallbacks } from './suggestion-event-handler';

export interface SuggestionListCallbacks {
  onItemSelected: (index: number) => void;
  onNavigateIntoDirectory: (file: FileInfo) => void;
  onEscape: () => void;
  onOpenFileInEditor?: (filePath: string) => Promise<void>;
  getIsComposing?: () => boolean;
  getCurrentPath?: () => string; // Current directory path for header display
  getBaseDir?: () => string; // Base directory for relative path calculations
  getCurrentQuery?: () => string; // Current search query for highlighting
  getCodeSearchQuery?: () => string; // Code search query for symbol highlighting
  countFilesInDirectory?: (path: string) => number; // Count files in directory
  onMouseEnterInfo?: (suggestion: SuggestionItem, target: HTMLElement) => void; // Info icon hover
  onMouseLeaveInfo?: () => void; // Info icon leave
}

/**
 * Manages the suggestion list dropdown UI and interactions
 */
export class SuggestionListManager {
  private textInput: HTMLTextAreaElement;
  private callbacks: SuggestionListCallbacks;

  private suggestionsContainer: HTMLElement | null = null;
  private isVisible: boolean = false;
  private selectedIndex: number = 0;
  private mergedSuggestions: SuggestionItem[] = [];

  // Specialized managers (initialized in initializeManagers)
  private renderer!: SuggestionItemRenderer;
  private positionCalculator!: SuggestionPositionCalculator;
  private eventHandler!: SuggestionEventHandler;

  constructor(
    textInput: HTMLTextAreaElement,
    callbacks: SuggestionListCallbacks
  ) {
    this.textInput = textInput;
    this.callbacks = callbacks;

    this.initializeContainer();
    this.initializeManagers();
  }

  /**
   * Initialize specialized managers with delegation callbacks
   */
  private initializeManagers(): void {
    // Renderer callbacks
    const rendererCallbacks: SuggestionItemRendererCallbacks = {
      ...(this.callbacks.getCurrentQuery && { getCurrentQuery: this.callbacks.getCurrentQuery }),
      ...(this.callbacks.getCodeSearchQuery && { getCodeSearchQuery: this.callbacks.getCodeSearchQuery }),
      ...(this.callbacks.getBaseDir && { getBaseDir: this.callbacks.getBaseDir }),
      ...(this.callbacks.getCurrentPath && { getCurrentPath: this.callbacks.getCurrentPath }),
      ...(this.callbacks.countFilesInDirectory && { countFilesInDirectory: this.callbacks.countFilesInDirectory }),
      ...(this.callbacks.onMouseEnterInfo && { onMouseEnterInfo: this.callbacks.onMouseEnterInfo }),
      ...(this.callbacks.onMouseLeaveInfo && { onMouseLeaveInfo: this.callbacks.onMouseLeaveInfo }),
    };

    // Position calculator callbacks
    const positionCallbacks: SuggestionPositionCallbacks = {
      getContainer: () => this.suggestionsContainer,
      getTextInput: () => this.textInput,
    };

    // Event handler callbacks
    const eventCallbacks: SuggestionEventCallbacks = {
      onItemSelected: (index: number) => this.callbacks.onItemSelected(index),
      onNavigateIntoDirectory: (index: number) => {
        const suggestion = this.mergedSuggestions[index];
        if (suggestion?.type === 'file' && suggestion.file) {
          this.callbacks.onNavigateIntoDirectory(suggestion.file);
        }
      },
      onEscape: () => this.callbacks.onEscape(),
      onOpenFileInEditor: async (index: number) => {
        const suggestion = this.mergedSuggestions[index];
        if (suggestion && this.callbacks.onOpenFileInEditor) {
          const filePath = this.getFilePathFromSuggestion(suggestion);
          if (filePath) {
            await this.callbacks.onOpenFileInEditor(filePath);
          }
        }
      },
      ...(this.callbacks.getIsComposing && { getIsComposing: this.callbacks.getIsComposing }),
      getSelectedIndex: () => this.selectedIndex,
      setSelectedIndex: (index: number) => { this.selectedIndex = index; },
      getTotalItemCount: () => this.getTotalItemCount(),
      getSuggestion: (index: number) => this.mergedSuggestions[index] || null,
      updateSelection: () => this.updateSelection(),
      hide: () => this.hide(),
    };

    this.renderer = new SuggestionItemRenderer(rendererCallbacks);
    this.positionCalculator = new SuggestionPositionCalculator(positionCallbacks);
    this.eventHandler = new SuggestionEventHandler(eventCallbacks);
  }

  /**
   * Initialize the suggestions container
   */
  private initializeContainer(): void {
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
      }
    }
  }

  /**
   * Show suggestions at a specific position
   * @param suggestions - Array of suggestions to display
   * @param atPosition - Character position of @ in textarea
   * @param isIndexBuilding - Whether the file index is currently being built
   */
  public show(suggestions: SuggestionItem[], atPosition: number, isIndexBuilding: boolean = false): void {
    if (!this.suggestionsContainer) return;

    this.mergedSuggestions = suggestions;
    this.selectedIndex = 0;
    this.isVisible = true;

    this.renderSuggestions(isIndexBuilding);
    this.positionCalculator.position(atPosition);
    this.updateSelection();
  }

  /**
   * Hide the suggestions dropdown
   */
  public hide(): void {
    if (!this.suggestionsContainer) return;

    this.isVisible = false;
    this.suggestionsContainer.style.display = 'none';

    // Clear container safely
    while (this.suggestionsContainer.firstChild) {
      this.suggestionsContainer.removeChild(this.suggestionsContainer.firstChild);
    }

    this.mergedSuggestions = [];
  }

  /**
   * Handle keyboard navigation
   * @returns true if event was handled, false otherwise
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isVisible) return false;
    return this.eventHandler.handleKeyDown(e);
  }

  /**
   * Get the currently selected index
   */
  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /**
   * Get the currently selected suggestion
   */
  public getSelectedSuggestion(): SuggestionItem | null {
    return this.mergedSuggestions[this.selectedIndex] || null;
  }

  /**
   * Check if suggestions are visible
   */
  public isActive(): boolean {
    return this.isVisible;
  }

  /**
   * Update suggestions without changing position
   * Used for refreshing content while keeping dropdown in place
   */
  public update(suggestions: SuggestionItem[], isIndexBuilding: boolean = false, newSelectedIndex?: number): void {
    if (!this.suggestionsContainer) return;

    this.mergedSuggestions = suggestions;
    if (newSelectedIndex !== undefined) {
      this.selectedIndex = newSelectedIndex;
    }
    this.renderSuggestions(isIndexBuilding);
    this.updateSelection();
  }

  /**
   * Position the suggestions container at the given @ position
   * Public method for external positioning control
   */
  public position(atPosition: number): void {
    this.positionCalculator.position(atPosition);
  }

  /**
   * Get the suggestions container element
   */
  public getContainer(): HTMLElement | null {
    return this.suggestionsContainer;
  }

  /**
   * Get total count of suggestion items
   */
  private getTotalItemCount(): number {
    return this.mergedSuggestions.length;
  }

  /**
   * Render the suggestions in the dropdown
   */
  private renderSuggestions(isIndexBuilding: boolean = false): void {
    if (!this.suggestionsContainer) return;

    this.renderer.renderAll(
      this.suggestionsContainer,
      this.mergedSuggestions,
      isIndexBuilding,
      (item: HTMLElement, index: number) => {
        if (this.suggestionsContainer) {
          this.eventHandler.attachItemEventListeners(item, index, this.suggestionsContainer);
        }
      }
    );
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
   * Extract file path from suggestion
   */
  private getFilePathFromSuggestion(suggestion: SuggestionItem): string | undefined {
    if (suggestion.type === 'file') {
      return suggestion.file?.path;
    } else if (suggestion.type === 'agent') {
      return suggestion.agent?.filePath;
    } else if (suggestion.type === 'symbol') {
      return suggestion.symbol?.filePath;
    }
    return undefined;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.hide();
    this.positionCalculator.destroy();
  }
}
