/**
 * Integration test for SuggestionUIManager stale async check.
 * Simulates the IME composition race condition where showSuggestions("")
 * (from initial "@" trigger) resolves AFTER showSuggestions("プロジェクト")
 * (from composition input), overwriting filtered results with unfiltered ones.
 *
 * @vitest-environment jsdom
 */

import { SuggestionUIManager } from '../../src/renderer/mentions/managers/suggestion-ui-manager';
import type { SuggestionItem } from '../../src/renderer/mentions/types';
import type { FileInfo, AgentItem } from '../../src/types';

// Track what was rendered
let lastRenderedSuggestions: SuggestionItem[] = [];

// Control async resolution order
let matchesPrefixResolvers: Array<(value: boolean) => void> = [];
let maxSuggestionsResolvers: Array<(value: number) => void> = [];

const allFiles: FileInfo[] = [
  { name: '_archive', path: '/test/_archive', isDirectory: true },
  { name: 'My Notes', path: '/test/My Notes', isDirectory: true },
  { name: 'DOCS', path: '/test/DOCS', isDirectory: true },
  { name: 'プロジェクト', path: '/test/プロジェクト', isDirectory: true },
  { name: 'ドキュメント', path: '/test/ドキュメント', isDirectory: true },
  { name: '設計書', path: '/test/設計書', isDirectory: true },
];

function setupDOM(): { textarea: HTMLTextAreaElement; container: HTMLElement } {
  // SuggestionUIManager needs these DOM elements
  const container = document.createElement('div');
  container.id = 'fileSuggestions';
  document.body.appendChild(container);

  const textarea = document.createElement('textarea');
  textarea.id = 'textInput';
  document.body.appendChild(textarea);

  return { textarea, container };
}

function createCallbacks() {
  const state = {
    filteredFiles: [] as FileInfo[],
    filteredAgents: [] as AgentItem[],
    currentPath: '',
  };

  return {
    getCachedDirectoryData: () => ({
      directory: '/test',
      files: allFiles,
      timestamp: Date.now(),
    }),
    getAtStartPosition: () => 0,
    adjustCurrentPathToQuery: () => {},
    filterFiles: (query: string) => {
      if (!query) return allFiles;
      const q = query.toLowerCase();
      return allFiles.filter(f => f.name.toLowerCase().includes(q));
    },
    mergeSuggestions: (query: string) => {
      return state.filteredFiles.map(f => ({
        type: 'file' as const,
        file: f,
        score: query ? 100 : 50,
      }));
    },
    searchAgents: async () => [] as AgentItem[],
    getFileUsageBonuses: async () => ({} as Record<string, number>),
    matchesSearchPrefix: async () => {
      return new Promise<boolean>(resolve => {
        matchesPrefixResolvers.push(resolve);
      });
    },
    getMaxSuggestions: async () => {
      return new Promise<number>(resolve => {
        maxSuggestionsResolvers.push(resolve);
      });
    },
    isIndexBeingBuilt: () => false,
    showIndexingHint: () => {},
    showTooltipForSelectedItem: () => {},
    setFilteredFiles: (f: FileInfo[]) => { state.filteredFiles = f; },
    setFilteredAgents: (a: AgentItem[]) => { state.filteredAgents = a; },
    setMergedSuggestions: () => {},
    setCurrentQuery: () => {},
    setCurrentPath: (p: string) => { state.currentPath = p; },
    getCurrentPath: () => state.currentPath,
    setSelectedIndex: () => {},
    setIsVisible: () => {},
    restoreDefaultHint: () => {},
  };
}

// Helper to flush microtasks
async function flushMicrotasks(count = 5) {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
}

describe('SuggestionUIManager stale async check', () => {
  let manager: SuggestionUIManager;
  let textarea: HTMLTextAreaElement;
  let container: HTMLElement;

  beforeEach(() => {
    matchesPrefixResolvers = [];
    maxSuggestionsResolvers = [];
    lastRenderedSuggestions = [];

    const dom = setupDOM();
    textarea = dom.textarea;
    container = dom.container;

    manager = new SuggestionUIManager(textarea, createCallbacks());

    // Spy on show() to track rendered suggestions without actual DOM rendering
    vi.spyOn(manager, 'show').mockImplementation((suggestions) => {
      lastRenderedSuggestions = [...suggestions];
    });
  });

  afterEach(() => {
    container.remove();
    textarea.remove();
    vi.restoreAllMocks();
  });

  test('stale showSuggestions("") does not overwrite filtered showSuggestions("プロジェクト")', async () => {
    // Step 1: showSuggestions("") - from "@" trigger
    const p1 = manager.showSuggestions('');
    // Step 2: showSuggestions("プロジェクト") - from composition
    const p2 = manager.showSuggestions('プロジェクト');

    expect(matchesPrefixResolvers).toHaveLength(2);

    // Resolve SECOND first (faster response for filtered query)
    matchesPrefixResolvers[1]!(false);
    await flushMicrotasks();

    // Second call should proceed to maxSuggestions
    expect(maxSuggestionsResolvers).toHaveLength(1);
    maxSuggestionsResolvers[0]!(20);
    await flushMicrotasks();

    // Now resolve FIRST (slow empty-query response arriving late)
    matchesPrefixResolvers[0]!(false);
    await flushMicrotasks();

    await Promise.allSettled([p1, p2]);

    // CRITICAL: Only "プロジェクト" should be in results, NOT all 6 files
    expect(lastRenderedSuggestions).toHaveLength(1);
    expect(lastRenderedSuggestions[0]?.file?.name).toBe('プロジェクト');
  });

  test('FIFO order: first call bails out, second call renders correctly', async () => {
    const p1 = manager.showSuggestions('');
    const p2 = manager.showSuggestions('プロジェクト');

    expect(matchesPrefixResolvers).toHaveLength(2);

    // Resolve in FIFO order
    matchesPrefixResolvers[0]!(false);
    await flushMicrotasks();

    // First call should bail (stale: seq=1 !== currentSeq=2)
    // It should NOT create a maxSuggestions resolver
    expect(maxSuggestionsResolvers).toHaveLength(0);

    // Resolve second
    matchesPrefixResolvers[1]!(false);
    await flushMicrotasks();

    expect(maxSuggestionsResolvers).toHaveLength(1);
    maxSuggestionsResolvers[0]!(20);
    await flushMicrotasks();

    await Promise.allSettled([p1, p2]);

    expect(lastRenderedSuggestions).toHaveLength(1);
    expect(lastRenderedSuggestions[0]?.file?.name).toBe('プロジェクト');
  });

  test('single call works normally', async () => {
    const p = manager.showSuggestions('プロジェクト');

    expect(matchesPrefixResolvers).toHaveLength(1);
    matchesPrefixResolvers[0]!(false);
    await flushMicrotasks();

    expect(maxSuggestionsResolvers).toHaveLength(1);
    maxSuggestionsResolvers[0]!(20);
    await flushMicrotasks();

    await p;

    expect(lastRenderedSuggestions).toHaveLength(1);
    expect(lastRenderedSuggestions[0]?.file?.name).toBe('プロジェクト');
  });

  test('many concurrent calls (rapid IME composition) - only latest takes effect', async () => {
    // Simulate: @ → プ → プロ → プロジェ → プロジェクト
    const promises = [
      manager.showSuggestions(''),
      manager.showSuggestions('プ'),
      manager.showSuggestions('プロ'),
      manager.showSuggestions('プロジェ'),
      manager.showSuggestions('プロジェクト'),
    ];

    expect(matchesPrefixResolvers).toHaveLength(5);

    // Resolve all in FIFO order
    for (let i = 0; i < 5; i++) {
      matchesPrefixResolvers[i]!(false);
      await flushMicrotasks();
    }

    // Only the LAST call (seq=5) should proceed to maxSuggestions
    expect(maxSuggestionsResolvers).toHaveLength(1);
    maxSuggestionsResolvers[0]!(20);
    await flushMicrotasks();

    await Promise.allSettled(promises);

    // Only "プロジェクト" directory should match
    expect(lastRenderedSuggestions).toHaveLength(1);
    expect(lastRenderedSuggestions[0]?.file?.name).toBe('プロジェクト');
  });

  test('empty query shows all items when no race condition', async () => {
    const p = manager.showSuggestions('');

    expect(matchesPrefixResolvers).toHaveLength(1);
    matchesPrefixResolvers[0]!(false);
    await flushMicrotasks();

    expect(maxSuggestionsResolvers).toHaveLength(1);
    maxSuggestionsResolvers[0]!(20);
    await flushMicrotasks();

    await p;

    // All 6 items should be shown
    expect(lastRenderedSuggestions).toHaveLength(6);
  });
});
