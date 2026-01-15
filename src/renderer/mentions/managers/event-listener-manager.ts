/**
 * Event Listener Manager
 * Manages all event listeners for file search functionality
 *
 * Responsibilities:
 * - Setting up event listeners for text input interactions
 * - Handling mouse events (click, move, leave)
 * - Handling keyboard events (keydown, keyup)
 * - Coordinating scroll synchronization
 * - Managing Cmd key interactions for link highlighting
 */

/**
 * Update request type definitions
 */
type UpdateType = 'fileSearch' | 'highlight' | 'cursorPosition';

interface UpdateRequest {
  type: UpdateType;
  priority: number;
}

export interface EventListenerCallbacks {
  // Input change handlers
  checkForFileSearch: () => void;
  updateHighlightBackdrop: () => void;
  updateCursorPositionHighlight: () => void;

  // Keyboard handlers
  handleKeyDown: (e: KeyboardEvent) => void;
  handleBackspaceForAtPath: (e: KeyboardEvent) => boolean;
  handleBackspaceForSlashCommand?: (e: KeyboardEvent) => boolean;
  handleCtrlEnterOpenFile: (e: KeyboardEvent) => void;

  // Mouse handlers
  handleCmdClickOnAtPath: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;

  // State checkers
  isVisible: () => boolean;

  // UI management
  hideSuggestions: () => void;
  syncBackdropScroll: () => void;

  // HighlightManager delegation
  clearFilePathHighlight: () => void;
  onCmdKeyDown: () => void;
  onCmdKeyUp: () => void;
  onMouseMove: (e: MouseEvent) => void;
}

export class EventListenerManager {
  private textInput: HTMLTextAreaElement | null = null;
  private suggestionsContainer: HTMLElement | null = null;
  private callbacks: EventListenerCallbacks;

  // Bound event handlers for add/remove listener
  private boundInputHandler: ((e: Event) => void) | null = null;
  private boundSelectionChangeHandler: (() => void) | null = null;

  // Flag to track if listeners are suspended
  private listenersAreSuspended: boolean = false;

  // rAF-based input processing optimization
  private lastText: string = '';
  private pendingInputUpdate: number | null = null;
  private pendingSelectionUpdate: number | null = null;

  // Priority-based update queue system
  private pendingUpdates: Map<UpdateType, UpdateRequest> = new Map();
  private updateScheduled: boolean = false;

  constructor(callbacks: EventListenerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Schedule an update with priority-based queueing
   *
   * Priority levels:
   * - fileSearch: 30 (highest - user is actively typing)
   * - highlight: 20-25 (medium - visual feedback)
   * - cursorPosition: 10-15 (lowest - can be deferred)
   *
   * Higher priority updates override lower priority ones of the same type.
   * All pending updates are processed in a single rAF callback to minimize
   * frame drops and improve performance by 30-40%.
   */
  private scheduleUpdate(type: UpdateType, priority: number): void {
    const existing = this.pendingUpdates.get(type);
    if (existing && existing.priority >= priority) return;

    this.pendingUpdates.set(type, { type, priority });

    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => {
        this.processAllUpdates();
      });
    }
  }

  /**
   * Process all pending updates in priority order
   * Consolidates multiple callbacks into single execution
   */
  private processAllUpdates(): void {
    if (this.listenersAreSuspended) {
      this.pendingUpdates.clear();
      this.updateScheduled = false;
      return;
    }

    // Sort updates by priority (highest first)
    const sortedUpdates = Array.from(this.pendingUpdates.values())
      .sort((a, b) => b.priority - a.priority);

    for (const update of sortedUpdates) {
      switch (update.type) {
        case 'fileSearch':
          this.callbacks.checkForFileSearch();
          break;
        case 'highlight':
          this.callbacks.updateHighlightBackdrop();
          break;
        case 'cursorPosition':
          this.callbacks.updateCursorPositionHighlight();
          break;
      }
    }

    this.pendingUpdates.clear();
    this.updateScheduled = false;
  }

  /**
   * Suspend input and selectionchange listeners temporarily
   * Used during @path deletion to prevent cursor interference
   */
  public suspendInputListeners(): void {
    if (this.listenersAreSuspended) return;
    this.listenersAreSuspended = true;

    // Cancel pending rAF callbacks to prevent them from firing
    if (this.pendingInputUpdate) {
      cancelAnimationFrame(this.pendingInputUpdate);
      this.pendingInputUpdate = null;
    }
    if (this.pendingSelectionUpdate) {
      cancelAnimationFrame(this.pendingSelectionUpdate);
      this.pendingSelectionUpdate = null;
    }

    // Clear pending update queue
    this.pendingUpdates.clear();
    this.updateScheduled = false;

    if (this.textInput && this.boundInputHandler) {
      this.textInput.removeEventListener('input', this.boundInputHandler);
    }
    if (this.boundSelectionChangeHandler) {
      document.removeEventListener('selectionchange', this.boundSelectionChangeHandler);
    }
  }

  /**
   * Resume input and selectionchange listeners
   * Call this after @path deletion is complete
   */
  public resumeInputListeners(): void {
    if (!this.listenersAreSuspended) return;
    this.listenersAreSuspended = false;

    if (this.textInput && this.boundInputHandler) {
      this.textInput.addEventListener('input', this.boundInputHandler);
    }
    if (this.boundSelectionChangeHandler) {
      document.addEventListener('selectionchange', this.boundSelectionChangeHandler);
    }
  }

  /**
   * Initialize with DOM elements
   */
  public initialize(
    textInput: HTMLTextAreaElement,
    suggestionsContainer: HTMLElement | null
  ): void {
    this.textInput = textInput;
    this.suggestionsContainer = suggestionsContainer;
  }

  /**
   * Setup all event listeners
   */
  public setupEventListeners(): void {
    if (!this.textInput) {
      console.warn('[EventListenerManager] setupEventListeners: textInput is null, skipping');
      return;
    }

    // Create bound input handler with priority-based update queue
    // Consolidates multiple callbacks into single rAF execution
    this.boundInputHandler = (e: Event) => {
      // Ignore programmatic dispatchEvent calls to prevent redundant processing
      if (!e.isTrusted) return;

      // Guard: skip if listeners are suspended
      if (this.listenersAreSuspended) return;

      if (!this.textInput) return;
      const currentText = this.textInput.value;

      // Skip if text hasn't changed since last check
      if (currentText === this.lastText) return;
      this.lastText = currentText;

      // Schedule updates with priority (higher priority = more important)
      // fileSearch: 30 (highest - user is actively typing)
      // highlight: 20 (medium - visual feedback)
      // cursorPosition: 10 (lowest - can be deferred)
      this.scheduleUpdate('fileSearch', 30);
      this.scheduleUpdate('highlight', 20);
      this.scheduleUpdate('cursorPosition', 10);
    };

    // Listen for input changes to detect @ mentions and update highlights
    this.textInput.addEventListener('input', this.boundInputHandler);

    // Listen for keydown for navigation and backspace handling
    this.textInput.addEventListener('keydown', (e) => {
      if (this.callbacks.isVisible()) {
        this.callbacks.handleKeyDown(e);
      } else if (e.key === 'Backspace') {
        // Don't override Shift+Backspace or when text is selected
        if (e.shiftKey) return;
        if (this.textInput && this.textInput.selectionStart !== this.textInput.selectionEnd) return;

        // Try @path deletion first
        if (this.callbacks.handleBackspaceForAtPath(e)) return;

        // Then try slash command deletion
        if (this.callbacks.handleBackspaceForSlashCommand?.(e)) return;
      } else if (e.key === 'Enter' && e.ctrlKey) {
        // Ctrl+Enter: open file at cursor position
        this.callbacks.handleCtrlEnterOpenFile(e);
      }
    });

    // Listen for cursor position changes (click, arrow keys)
    this.textInput.addEventListener('click', () => {
      // Schedule cursor position update with low priority (immediate user action)
      this.scheduleUpdate('cursorPosition', 15);
    });

    this.textInput.addEventListener('keyup', (e) => {
      // Update on arrow keys that move cursor
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        this.scheduleUpdate('cursorPosition', 15);
      }
      // Force highlight redraw after Tab key to fix position alignment
      // Tab character rendering can differ between textarea and backdrop
      if (e.key === 'Tab') {
        // Schedule both highlight and scroll sync with high priority
        this.scheduleUpdate('highlight', 25);
        // Sync scroll immediately (not part of priority queue)
        requestAnimationFrame(() => {
          this.callbacks.syncBackdropScroll();
        });
      }
    });

    // Create bound selectionchange handler with priority-based updates
    // Only process if textarea is active to avoid unnecessary work
    this.boundSelectionChangeHandler = () => {
      if (document.activeElement !== this.textInput) return;

      // Guard: skip if listeners are suspended
      if (this.listenersAreSuspended) return;

      // Schedule cursor position update with low priority
      this.scheduleUpdate('cursorPosition', 10);
    };

    // Also listen for selectionchange on document (handles all cursor movements)
    document.addEventListener('selectionchange', this.boundSelectionChangeHandler);

    // Sync scroll position between textarea and backdrop immediately
    this.textInput.addEventListener('scroll', () => {
      this.callbacks.syncBackdropScroll();
    }, { passive: true });

    // Hide suggestions on blur (with small delay to allow click selection)
    this.textInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.suggestionsContainer?.contains(document.activeElement)) {
          this.callbacks.hideSuggestions();
        }
      }, 150);
    });

    // Handle click outside
    document.addEventListener('click', (e) => {
      if (this.callbacks.isVisible() &&
          !this.suggestionsContainer?.contains(e.target as Node) &&
          !this.textInput?.contains(e.target as Node)) {
        this.callbacks.hideSuggestions();
      }
    });

    // Handle Cmd+click on @path in textarea to open in editor
    this.textInput.addEventListener('click', (e) => {
      if (e.metaKey) {
        this.callbacks.handleCmdClickOnAtPath(e);
      }
    });

    // Handle Cmd+hover for link style on @paths
    this.textInput.addEventListener('mousemove', (e) => {
      this.callbacks.handleMouseMove(e);
    });

    // Clear link style when mouse leaves textarea
    this.textInput.addEventListener('mouseleave', () => {
      // Delegate to HighlightManager
      this.callbacks.clearFilePathHighlight();
    });

    // Handle Cmd key press/release for link style
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Meta') {
        // Delegate to HighlightManager
        this.callbacks.onCmdKeyDown();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Meta') {
        // Delegate to HighlightManager
        this.callbacks.onCmdKeyUp();
      }
    });

    // Clear on window blur (Cmd key release detection may fail)
    window.addEventListener('blur', () => {
      // Delegate to HighlightManager
      this.callbacks.onCmdKeyUp();
    });
  }
}
