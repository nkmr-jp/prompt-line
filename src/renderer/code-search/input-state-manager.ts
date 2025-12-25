/**
 * Input State Manager
 * Handles input events, emoji conversion prevention, and code search pattern detection
 */

// Pattern to detect if we're in the middle of typing @lang:query (requires colon to be present)
// This ensures we only block emoji conversion for code search, not file search (@path)
const CODE_SEARCH_TYPING_PATTERN = /@[a-z]+:[^\s]*$/;
// Pattern to detect emoji in @lang:query pattern (for rollback after conversion)
const EMOJI_IN_CODE_SEARCH_PATTERN = /@[a-z]+:[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
const CODE_SEARCH_PATTERN = /@([a-z]+):(\S*)$/;
const DEBOUNCE_DELAY = 150;

interface InputStateCallbacks {
  onPatternDetected: (language: string, rawQuery: string, startIndex: number, endIndex: number) => void;
  onPatternCleared: () => void;
  getTextContent: () => string;
  setTextContent: (text: string) => void;
  getCursorPosition: () => number;
  setCursorPosition: (position: number) => void;
  getIsComposing: () => boolean;
}

/**
 * InputStateManager class
 * Manages input event handling and code search pattern detection
 */
export class InputStateManager {
  private callbacks: InputStateCallbacks;
  private textInput: HTMLTextAreaElement | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // State for emoji conversion rollback
  private textBeforeEmojiConversion: { text: string; cursorPos: number } | null = null;

  constructor(callbacks: InputStateCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Initialize and setup event listeners
   */
  initialize(): void {
    this.textInput = document.getElementById('textInput') as HTMLTextAreaElement;
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.textInput) {
      console.warn('[InputStateManager] setupEventListeners: textInput is null, skipping');
      return;
    }

    this.textInput.addEventListener('input', () => this.handleInput());
    this.textInput.addEventListener('beforeinput', (e) => this.handleBeforeInput(e));
  }

  /**
   * Handle beforeinput event to block emoji conversion during @lang: pattern typing
   * macOS automatically converts :shortcode: patterns (like :link:) to emoji (🔗)
   * This prevents that conversion when user is typing code search patterns like @md:link
   */
  private handleBeforeInput(e: InputEvent): void {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const cursorPos = this.textInput.selectionStart ?? 0;
    const textBeforeCursor = text.substring(0, cursorPos);

    // Check if we're in the middle of typing @lang:query pattern
    if (CODE_SEARCH_TYPING_PATTERN.test(textBeforeCursor)) {
      // Save state before any input that might be emoji conversion
      // This allows rollback in handleInput if conversion happens
      this.textBeforeEmojiConversion = { text, cursorPos };

      // Try to block 'insertReplacementText' type (emoji conversion)
      if (e.inputType === 'insertReplacementText') {
        e.preventDefault();
        console.debug('[InputStateManager] Blocked emoji conversion during code search typing', {
          inputType: e.inputType,
          data: e.data,
          textBeforeCursor
        });
      }
    }
  }

  /**
   * Handle input event
   */
  private handleInput(): void {
    // Check for emoji conversion and rollback if needed
    if (this.textBeforeEmojiConversion && this.textInput) {
      const currentText = this.textInput.value;
      // Check if emoji was inserted in the @lang: pattern
      if (EMOJI_IN_CODE_SEARCH_PATTERN.test(currentText)) {
        // Rollback to the text before emoji conversion
        const { text: previousText, cursorPos: previousCursorPos } = this.textBeforeEmojiConversion;
        this.textInput.value = previousText;
        this.textInput.setSelectionRange(previousCursorPos, previousCursorPos);
        console.debug('[InputStateManager] Rolled back emoji conversion', {
          currentText,
          previousText
        });
        this.textBeforeEmojiConversion = null;
        return; // Don't process further since we rolled back
      }
      this.textBeforeEmojiConversion = null;
    }

    if (!this.textInput || this.callbacks.getIsComposing()) {
      return;
    }

    // Debounce input handling
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.checkForCodeSearch();
    }, DEBOUNCE_DELAY);
  }

  /**
   * Check for @<ext>:<query> pattern and notify callback
   */
  private checkForCodeSearch(): void {
    if (!this.textInput) return;

    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Get text before cursor
    const textBeforeCursor = text.substring(0, cursorPos);

    // Check for pattern
    const match = textBeforeCursor.match(CODE_SEARCH_PATTERN);
    if (!match || !match[1]) {
      this.callbacks.onPatternCleared();
      return;
    }

    const language = match[1];
    const rawQuery = match[2] ?? '';
    const startIndex = textBeforeCursor.lastIndexOf('@');
    const endIndex = cursorPos;

    this.callbacks.onPatternDetected(language, rawQuery, startIndex, endIndex);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
