/**
 * Search Manager for renderer process
 * Manages search functionality and history filtering
 */

interface HistoryItem {
  text: string;
  timestamp: number;
  id: string;
}

export class SearchManager {
  private searchButton: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private searchClose: HTMLElement | null = null;
  private historyHeader: HTMLElement | null = null;
  private isSearchMode: boolean = false;
  private onSearchStateChange: (isSearchMode: boolean, filteredData: HistoryItem[]) => void;
  private historyData: HistoryItem[] = [];

  constructor(callbacks: {
    onSearchStateChange: (isSearchMode: boolean, filteredData: HistoryItem[]) => void;
  }) {
    this.onSearchStateChange = callbacks.onSearchStateChange;
  }

  public initializeElements(): void {
    this.searchButton = document.getElementById('searchButton');
    this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
    this.searchClose = document.getElementById('searchClose');
    this.historyHeader = document.querySelector('.history-header');
  }

  public setupEventListeners(): void {
    // Search functionality event listeners
    if (this.searchButton) {
      this.searchButton.addEventListener('click', () => {
        this.toggleSearchMode();
      });
    }

    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        this.performSearch();
      });

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.exitSearchMode();
          return;
        }
      });
    }

    if (this.searchClose) {
      // Add comprehensive event handling
      this.searchClose.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Use mousedown for more reliable triggering
        this.exitSearchMode();
      });

      this.searchClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      });

      this.searchClose.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.exitSearchMode();
      });

      // Add tabindex to make it focusable
      this.searchClose.setAttribute('tabindex', '0');
      
      // Add keyboard support
      this.searchClose.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.exitSearchMode();
        }
      });
    }
  }

  public updateHistoryData(historyData: HistoryItem[]): void {
    this.historyData = historyData;
  }

  public toggleSearchMode(): void {
    if (this.isSearchMode) {
      // If already in search mode, just focus the search input
      this.searchInput?.focus();
    } else {
      // Enter search mode
      this.isSearchMode = true;
      this.enterSearchMode();
    }
  }

  public enterSearchMode(): void {
    if (!this.historyHeader || !this.searchButton || !this.searchInput) return;
    
    this.isSearchMode = true;
    this.historyHeader.classList.add('search-mode');
    this.searchButton.classList.add('active');
    
    // Focus on search input
    setTimeout(() => {
      this.searchInput?.focus();
    }, 100);
    
    // Initialize filtered data with all items
    this.onSearchStateChange(true, [...this.historyData]);
  }

  public exitSearchMode(): void {
    if (!this.historyHeader || !this.searchButton || !this.searchInput) {
      return;
    }
    
    this.isSearchMode = false;
    this.historyHeader.classList.remove('search-mode');
    this.searchButton.classList.remove('active');
    this.searchInput.value = '';
    
    // Reset to show all history items
    this.onSearchStateChange(false, [...this.historyData]);
  }

  private performSearch(): void {
    if (!this.searchInput || !this.isSearchMode) return;
    
    const query = this.searchInput.value.toLowerCase().trim();
    
    let filteredData: HistoryItem[];
    if (query === '') {
      // Show all items when search is empty
      filteredData = [...this.historyData];
    } else {
      // Filter items based on search query
      filteredData = this.historyData.filter(item => 
        item.text.toLowerCase().includes(query)
      );
    }
    
    this.onSearchStateChange(true, filteredData);
  }

  public highlightSearchTerms(text: string, searchTerm: string): string {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  }

  public getSearchTerm(): string {
    return this.searchInput?.value.trim() || '';
  }

  public isInSearchMode(): boolean {
    return this.isSearchMode;
  }

  public focusMainTextarea(): void {
    const textarea = document.getElementById('textInput') as HTMLTextAreaElement;
    textarea?.focus();
  }
}