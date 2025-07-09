export class DomManager {
  public textarea: HTMLTextAreaElement | null = null;
  public appNameEl: HTMLElement | null = null;
  public charCountEl: HTMLElement | null = null;
  public historyList: HTMLElement | null = null;
  public headerShortcutsEl: HTMLElement | null = null;
  public historyShortcutsEl: HTMLElement | null = null;
  public searchInput: HTMLInputElement | null = null;

  public initializeElements(): void {
    this.textarea = document.getElementById('textInput') as HTMLTextAreaElement;
    this.appNameEl = document.getElementById('appName');
    this.charCountEl = document.getElementById('charCount');
    this.historyList = document.getElementById('historyList');
    this.headerShortcutsEl = document.getElementById('headerShortcuts');
    this.historyShortcutsEl = document.getElementById('historyShortcuts');
    this.searchInput = document.getElementById('searchInput') as HTMLInputElement;

    if (!this.textarea || !this.appNameEl || !this.charCountEl || !this.historyList) {
      throw new Error('Required DOM elements not found');
    }
  }

  public updateCharCount(): void {
    if (!this.textarea || !this.charCountEl) return;
    
    const count = this.textarea.value.length;
    this.charCountEl.textContent = `${count} char${count !== 1 ? 's' : ''}`;
  }

  public updateAppName(name: string): void {
    if (this.appNameEl) {
      this.appNameEl.textContent = name;
    }
  }

  public showError(message: string, duration: number = 2000): void {
    if (!this.appNameEl) return;
    
    const originalText = this.appNameEl.textContent;
    this.appNameEl.textContent = `Error: ${message}`;
    this.appNameEl.classList.add('app-name-error');

    setTimeout(() => {
      if (this.appNameEl) {
        this.appNameEl.textContent = originalText;
        this.appNameEl.classList.remove('app-name-error');
      }
    }, duration);
  }

  public insertTextAtCursor(text: string): void {
    if (!this.textarea) return;

    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const value = this.textarea.value;

    this.textarea.value = value.substring(0, start) + text + value.substring(end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
    this.updateCharCount();
  }

  public clearText(): void {
    if (this.textarea) {
      this.textarea.value = '';
      this.updateCharCount();
    }
  }

  public setText(text: string): void {
    if (this.textarea) {
      this.textarea.value = text;
      this.updateCharCount();
    }
  }

  public getCurrentText(): string {
    return this.textarea?.value || '';
  }

  public focusTextarea(): void {
    this.textarea?.focus();
  }

  public selectAll(): void {
    this.textarea?.select();
  }

  public setCursorPosition(position: number): void {
    if (this.textarea) {
      this.textarea.setSelectionRange(position, position);
    }
  }
}