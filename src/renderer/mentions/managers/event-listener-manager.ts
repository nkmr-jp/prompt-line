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

export interface EventListenerCallbacks {
  // Input change handlers
  checkForFileSearch: () => void;
  updateHighlightBackdrop: () => void;
  updateCursorPositionHighlight: () => void;

  // Keyboard handlers
  handleKeyDown: (e: KeyboardEvent) => void;
  handleBackspaceForAtPath: (e: KeyboardEvent) => void;
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
  private boundInputHandler: (() => void) | null = null;
  private boundSelectionChangeHandler: (() => void) | null = null;

  // Flag to track if listeners are suspended
  private listenersAreSuspended: boolean = false;

  constructor(callbacks: EventListenerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Suspend input and selectionchange listeners temporarily
   * Used during @path deletion to prevent cursor interference
   */
  public suspendInputListeners(): void {
    if (this.listenersAreSuspended) return;
    this.listenersAreSuspended = true;

    if (this.textInput && this.boundInputHandler) {
      this.textInput.removeEventListener('input', this.boundInputHandler);
    }
    if (this.boundSelectionChangeHandler) {
      document.removeEventListener('selectionchange', this.boundSelectionChangeHandler);
    }
    console.debug('[EventListenerManager] Input listeners suspended');
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
    console.debug('[EventListenerManager] Input listeners resumed');
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

    // Create bound input handler for add/remove listener support
    this.boundInputHandler = () => {
      this.callbacks.checkForFileSearch();
      this.callbacks.updateHighlightBackdrop();
      // Update cursor position highlight after input
      this.callbacks.updateCursorPositionHighlight();
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
        // Handle backspace to delete entire @path if cursor is at the end of one
        this.callbacks.handleBackspaceForAtPath(e);
      } else if (e.key === 'Enter' && e.ctrlKey) {
        // Ctrl+Enter: open file at cursor position
        this.callbacks.handleCtrlEnterOpenFile(e);
      }
    });

    // Listen for cursor position changes (click, arrow keys)
    this.textInput.addEventListener('click', () => {
      this.callbacks.updateCursorPositionHighlight();
    });

    this.textInput.addEventListener('keyup', (e) => {
      // Update on arrow keys that move cursor
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        this.callbacks.updateCursorPositionHighlight();
      }
      // Force highlight redraw after Tab key to fix position alignment
      // Tab character rendering can differ between textarea and backdrop
      if (e.key === 'Tab') {
        // Use requestAnimationFrame to ensure the DOM has updated
        requestAnimationFrame(() => {
          this.callbacks.updateHighlightBackdrop();
          this.callbacks.syncBackdropScroll();
        });
      }
    });

    // Create bound selectionchange handler for add/remove listener support
    this.boundSelectionChangeHandler = () => {
      if (document.activeElement === this.textInput) {
        this.callbacks.updateCursorPositionHighlight();
      }
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
