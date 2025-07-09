// Types for browser environment
interface Theme {
  background: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
}

interface Elements {
  container?: HTMLElement | null;
  inputWrapper?: HTMLElement | null;
  textarea?: HTMLTextAreaElement | null;
  appName?: HTMLElement | null;
  charCount?: HTMLElement | null;
  historyContainer?: HTMLElement | null;
  historyList?: HTMLElement | null;
  shortcuts?: HTMLElement | null;
  hint?: HTMLElement | null;
}

type NotificationType = 'info' | 'success' | 'warning' | 'error';
type AnimationType = 'pulse' | 'shake' | 'fade-in' | 'fade-out' | 'slide-up' | 'highlight';

class UIManager {
  private elements: Elements = {};
  private themes: Record<string, Theme>;
  private currentTheme: string;
  private animations: Map<string, unknown>;

  constructor() {
    this.themes = {
      dark: {
        background: 'rgba(20, 20, 20, 0.95)',
        text: '#ffffff',
        textSecondary: 'rgba(255, 255, 255, 0.6)',
        border: 'rgba(255, 255, 255, 0.15)',
        accent: '#007AFF'
      },
      light: {
        background: 'rgba(255, 255, 255, 0.95)',
        text: '#000000',
        textSecondary: 'rgba(0, 0, 0, 0.6)',
        border: 'rgba(0, 0, 0, 0.15)',
        accent: '#007AFF'
      }
    };
    this.currentTheme = 'dark';
    this.animations = new Map();
  }

  init(): void {
    this.cacheElements();
    this.setupAnimations();
    this.applyTheme(this.currentTheme);
  }

  private cacheElements(): void {
    this.elements = {
      container: document.querySelector('.container'),
      inputWrapper: document.querySelector('.input-wrapper'),
      textarea: document.getElementById('textInput') as HTMLTextAreaElement,
      appName: document.getElementById('appName'),
      charCount: document.getElementById('charCount'),
      historyContainer: document.querySelector('.history-container'),
      historyList: document.getElementById('historyList'),
      shortcuts: document.querySelector('.shortcuts'),
      hint: document.querySelector('.hint')
    };
  }

  private setupAnimations(): void {
    // Animation system disabled for instant UI
  }

  applyTheme(themeName: string): void {
    if (!this.themes[themeName]) {
      console.warn(`Unknown theme: ${themeName}`);
      return;
    }

    this.currentTheme = themeName;
    const theme = this.themes[themeName];

    document.documentElement.style.setProperty('--bg-color', theme.background);
    document.documentElement.style.setProperty('--text-color', theme.text);
    document.documentElement.style.setProperty('--text-secondary', theme.textSecondary);
    document.documentElement.style.setProperty('--border-color', theme.border);
    document.documentElement.style.setProperty('--accent-color', theme.accent);

    document.body.className = `theme-${themeName}`;
  }

  showNotification(message: string, type: NotificationType = 'info', duration = 3000): HTMLElement {
    this.clearNotifications();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type} fade-in`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('fade-out');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, duration);

    return notification;
  }

  clearNotifications(): void {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  animate(_element: HTMLElement, _animationName: AnimationType, callback: (() => void) | null = null): void {
    // Animation disabled for instant UI
    if (callback) callback();
  }

  highlight(element: HTMLElement): void {
    this.animate(element, 'highlight');
  }

  pulse(element: HTMLElement): void {
    this.animate(element, 'pulse');
  }

  shake(element: HTMLElement): void {
    this.animate(element, 'shake');
  }

  updateCharCount(count: number, maxCount: number | null = null): void {
    if (!this.elements.charCount) return;

    const text = `${count} char${count !== 1 ? 's' : ''}`;
    this.elements.charCount.textContent = text;

    // Remove existing color classes
    this.elements.charCount.classList.remove('char-count-warning', 'char-count-error');

    if (maxCount) {
      const percentage = count / maxCount;
      if (percentage > 0.9) {
        this.elements.charCount.classList.add('char-count-error');
      } else if (percentage > 0.7) {
        this.elements.charCount.classList.add('char-count-warning');
      }
    }
  }

  updateAppName(name: string, _animate = true): void {
    if (!this.elements.appName) return;
    this.elements.appName.textContent = name;
  }

  setLoading(loading: boolean): void {
    if (loading) {
      if (this.elements.textarea) {
        this.elements.textarea.disabled = true;
        this.elements.textarea.classList.add('textarea-loading');
      }
      
      document.body.classList.add('loading');
    } else {
      if (this.elements.textarea) {
        this.elements.textarea.disabled = false;
        this.elements.textarea.classList.remove('textarea-loading');
      }
      
      document.body.classList.remove('loading');
    }
  }

  focusInput(): void {
    if (this.elements.textarea) {
      this.elements.textarea.focus();
    }
  }

  showEmptyHistory(): void {
    if (this.elements.historyList) {
      this.elements.historyList.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">📝</div>
          <div>No history items</div>
          <div class="history-empty-subtitle">
            Start typing to create history
          </div>
        </div>
      `;
    }
  }

  showPasteSuccess(): void {
    this.showNotification('Text pasted successfully!', 'success', 2000);
  }

  showPasteError(error: string): void {
    this.showNotification(`Paste failed: ${error}`, 'error', 4000);
  }

  updateShortcuts(isMac = true): void {
    if (!this.elements.shortcuts) return;

    const cmdKey = isMac ? '⌘' : 'Ctrl';
    this.elements.shortcuts.innerHTML = `
      <kbd>${cmdKey}</kbd>+<kbd>↵</kbd> Paste
      <kbd>Esc</kbd> Close
    `;
  }

  getCurrentTheme(): string {
    return this.currentTheme;
  }

  toggleTheme(): string {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    return newTheme;
  }

  destroy(): void {
    this.clearNotifications();
    this.animations.clear();
    
    const styleElement = document.querySelector('#ui-animations');
    if (styleElement) {
      styleElement.remove();
    }
  }
}

// Make UIManager available globally for browser environment
declare global {
  interface Window {
    UIManager: typeof UIManager;
  }
}

window.UIManager = UIManager;

export default UIManager;