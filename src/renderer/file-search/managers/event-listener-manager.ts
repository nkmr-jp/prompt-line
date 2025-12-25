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

  constructor(callbacks: EventListenerCallbacks) {
    this.callbacks = callbacks;
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

    console.debug('[EventListenerManager] setupEventListeners: setting up event listeners');

    this.setupInputListeners();
    this.setupKeyboardListeners();
    this.setupCursorListeners();
    this.setupScrollListeners();
    this.setupBlurListeners();
    this.setupClickListeners();
    this.setupMouseListeners();
    this.setupCmdKeyListeners();
  }

  /**
   * Setup input event listeners for file search and highlight updates
   */
  private setupInputListeners(): void {
    this.textInput?.addEventListener('input', () => {
      console.debug('[EventListenerManager] input event fired');
      this.callbacks.checkForFileSearch();
      this.callbacks.updateHighlightBackdrop();
      this.callbacks.updateCursorPositionHighlight();
    });
  }

  /**
   * Setup keyboard event listeners for navigation and shortcuts
   */
  private setupKeyboardListeners(): void {
    this.textInput?.addEventListener('keydown', (e) => {
      if (this.callbacks.isVisible()) {
        this.callbacks.handleKeyDown(e);
      } else if (this.isBackspaceForAtPath(e)) {
        this.callbacks.handleBackspaceForAtPath(e);
      } else if (e.key === 'Enter' && e.ctrlKey) {
        this.callbacks.handleCtrlEnterOpenFile(e);
      }
    });

    this.textInput?.addEventListener('keyup', (e) => {
      if (this.isCursorMovementKey(e.key)) {
        this.callbacks.updateCursorPositionHighlight();
      }
    });
  }

  /**
   * Check if event is backspace for @path deletion
   */
  private isBackspaceForAtPath(e: KeyboardEvent): boolean {
    if (e.key !== 'Backspace') return false;
    if (e.shiftKey) return false;
    if (this.textInput && this.textInput.selectionStart !== this.textInput.selectionEnd) return false;
    return true;
  }

  /**
   * Check if key is a cursor movement key
   */
  private isCursorMovementKey(key: string): boolean {
    return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key);
  }

  /**
   * Setup cursor position tracking listeners
   */
  private setupCursorListeners(): void {
    this.textInput?.addEventListener('click', () => {
      this.callbacks.updateCursorPositionHighlight();
    });

    document.addEventListener('selectionchange', () => {
      if (document.activeElement === this.textInput) {
        this.callbacks.updateCursorPositionHighlight();
      }
    });
  }

  /**
   * Setup scroll synchronization listeners
   */
  private setupScrollListeners(): void {
    this.textInput?.addEventListener('scroll', () => {
      this.callbacks.syncBackdropScroll();
    });
  }

  /**
   * Setup blur and click-outside listeners
   */
  private setupBlurListeners(): void {
    this.textInput?.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.suggestionsContainer?.contains(document.activeElement)) {
          this.callbacks.hideSuggestions();
        }
      }, 150);
    });

    document.addEventListener('click', (e) => {
      if (this.callbacks.isVisible() &&
          !this.suggestionsContainer?.contains(e.target as Node) &&
          !this.textInput?.contains(e.target as Node)) {
        this.callbacks.hideSuggestions();
      }
    });
  }

  /**
   * Setup click event listeners for @path interaction
   */
  private setupClickListeners(): void {
    this.textInput?.addEventListener('click', (e) => {
      if (e.metaKey) {
        this.callbacks.handleCmdClickOnAtPath(e);
      }
    });
  }

  /**
   * Setup mouse event listeners for @path hover effects
   */
  private setupMouseListeners(): void {
    this.textInput?.addEventListener('mousemove', (e) => {
      this.callbacks.handleMouseMove(e);
    });

    this.textInput?.addEventListener('mouseleave', () => {
      this.callbacks.clearFilePathHighlight();
    });
  }

  /**
   * Setup Cmd key listeners for link style effects
   */
  private setupCmdKeyListeners(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Meta') {
        this.callbacks.onCmdKeyDown();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Meta') {
        this.callbacks.onCmdKeyUp();
      }
    });

    window.addEventListener('blur', () => {
      this.callbacks.onCmdKeyUp();
    });
  }
}
