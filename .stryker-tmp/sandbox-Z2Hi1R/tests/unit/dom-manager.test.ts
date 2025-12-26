/**
 * @jest-environment jsdom
 */
// @ts-nocheck


import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { DomManager } from '../../src/renderer/dom-manager';

describe('DomManager', () => {
  let domManager: DomManager;

  // Mock DOM elements
  const createMockTextarea = () => {
    const mock = {
      value: '',
      selectionStart: 0,
      selectionEnd: 0,
      setSelectionRange: jest.fn((start: number, end: number) => {
        mock.selectionStart = start;
        mock.selectionEnd = end;
      }),
      focus: jest.fn(),
      select: jest.fn()
    };
    return mock;
  };

  const createMockElement = () => {
    const classes = new Set<string>();
    return {
      textContent: '',
      style: {} as CSSStyleDeclaration,
      classList: {
        add: jest.fn((className: string) => classes.add(className)),
        remove: jest.fn((className: string) => classes.delete(className)),
        contains: jest.fn((className: string) => classes.has(className)),
        toggle: jest.fn((className: string) => {
          if (classes.has(className)) {
            classes.delete(className);
            return false;
          } else {
            classes.add(className);
            return true;
          }
        })
      }
    };
  };

  beforeEach(() => {
    // Clear document
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    // Create mock elements
    const mockTextarea = createMockTextarea();
    const mockAppName = createMockElement();
    const mockCharCount = createMockElement();
    const mockHistoryList = createMockElement();

    jest.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      switch (id) {
        case 'textInput': return mockTextarea as any;
        case 'appName': return mockAppName as any;
        case 'charCount': return mockCharCount as any;
        case 'historyList': return mockHistoryList as any;
        case 'searchInput': return createMockElement() as any;
        case 'headerShortcuts': return createMockElement() as any;
        case 'historyShortcuts': return createMockElement() as any;
        default: return null;
      }
    });

    domManager = new DomManager();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize DOM elements', () => {
      domManager.initializeElements();

      expect(document.getElementById).toHaveBeenCalledWith('textInput');
      expect(document.getElementById).toHaveBeenCalledWith('appName');
      expect(document.getElementById).toHaveBeenCalledWith('charCount');
      expect(document.getElementById).toHaveBeenCalledWith('historyList');
    });

    test('should throw error if required elements not found', () => {
      jest.spyOn(document, 'getElementById').mockReturnValue(null);

      expect(() => domManager.initializeElements()).toThrow('Required DOM elements not found');
    });
  });

  describe('text management', () => {
    beforeEach(() => {
      domManager.initializeElements();
    });

    test('should update character count', () => {
      domManager.textarea!.value = 'hello';
      domManager.updateCharCount();

      expect(domManager.charCountEl!.textContent).toBe('5 chars');
    });

    test('should show singular for single character', () => {
      domManager.textarea!.value = 'a';
      domManager.updateCharCount();

      expect(domManager.charCountEl!.textContent).toBe('1 char');
    });

    test('should set text and update count', () => {
      domManager.setText('test text');

      expect(domManager.textarea!.value).toBe('test text');
    });

    test('should clear text and update count', () => {
      domManager.textarea!.value = 'some text';
      domManager.clearText();

      expect(domManager.textarea!.value).toBe('');
    });

    test('should get current text', () => {
      domManager.textarea!.value = 'current text';

      expect(domManager.getCurrentText()).toBe('current text');
    });

    test('should return empty string if no textarea', () => {
      domManager.textarea = null;

      expect(domManager.getCurrentText()).toBe('');
    });
  });

  describe('cursor and focus management', () => {
    beforeEach(() => {
      domManager.initializeElements();
    });

    test('should focus textarea', () => {
      domManager.focusTextarea();

      expect(domManager.textarea!.focus).toHaveBeenCalled();
    });

    test('should select all text', () => {
      domManager.selectAll();

      expect(domManager.textarea!.select).toHaveBeenCalled();
    });

    test('should set cursor position', () => {
      domManager.setCursorPosition(5);

      expect(domManager.textarea!.setSelectionRange).toHaveBeenCalledWith(5, 5);
    });

    test('should insert text at cursor', () => {
      domManager.textarea!.value = 'hello world';
      domManager.textarea!.selectionStart = 5;
      domManager.textarea!.selectionEnd = 5;

      domManager.insertTextAtCursor(' beautiful');

      expect(domManager.textarea!.value).toBe('hello beautiful world');
      expect(domManager.textarea!.selectionStart).toBe(15);
      expect(domManager.textarea!.selectionEnd).toBe(15);
    });

    test('should replace selected text', () => {
      domManager.textarea!.value = 'hello world';
      domManager.textarea!.selectionStart = 6;
      domManager.textarea!.selectionEnd = 11;

      domManager.insertTextAtCursor('everyone');

      expect(domManager.textarea!.value).toBe('hello everyone');
      expect(domManager.textarea!.selectionStart).toBe(14);
      expect(domManager.textarea!.selectionEnd).toBe(14);
    });
  });

  describe('app name management', () => {
    beforeEach(() => {
      domManager.initializeElements();
    });

    test('should update app name', () => {
      domManager.updateAppName('Test App');

      expect(domManager.appNameEl!.textContent).toBe('Test App');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      domManager.initializeElements();
    });

    test('should show error with default duration', () => {
      domManager.appNameEl!.textContent = 'Original Text';

      domManager.showError('Test error');

      expect(domManager.appNameEl!.textContent).toBe('Error: Test error');
      expect(domManager.appNameEl!.classList.contains('app-name-error')).toBe(true);
    });

    test('should restore original text after error duration', (done) => {
      domManager.appNameEl!.textContent = 'Original Text';

      domManager.showError('Test error', 100);

      setTimeout(() => {
        expect(domManager.appNameEl!.textContent).toBe('Original Text');
        expect(domManager.appNameEl!.classList.contains('app-name-error')).toBe(false);
        done();
      }, 150);
    });
  });

  describe('null safety', () => {
    test('should handle null textarea gracefully', () => {
      domManager.textarea = null;

      expect(() => {
        domManager.updateCharCount();
        domManager.insertTextAtCursor('test');
        domManager.clearText();
        domManager.setText('test');
        domManager.focusTextarea();
        domManager.selectAll();
        domManager.setCursorPosition(0);
        domManager.outdentAtCursor();
      }).not.toThrow();
    });

    test('should handle null elements gracefully', () => {
      domManager.appNameEl = null;
      domManager.charCountEl = null;

      expect(() => {
        domManager.updateAppName('Test');
        domManager.showError('Error');
        domManager.updateCharCount();
      }).not.toThrow();
    });
  });

  describe('outdent functionality', () => {
    beforeEach(() => {
      domManager.initializeElements();
    });

    test('should remove leading tab from single line', () => {
      domManager.textarea!.value = '\thello world';
      domManager.textarea!.selectionStart = 1;
      domManager.textarea!.selectionEnd = 1;

      domManager.outdentAtCursor();

      expect(domManager.textarea!.value).toBe('hello world');
    });

    test('should remove up to 4 leading spaces from single line', () => {
      domManager.textarea!.value = '    hello world';
      domManager.textarea!.selectionStart = 4;
      domManager.textarea!.selectionEnd = 4;

      domManager.outdentAtCursor();

      expect(domManager.textarea!.value).toBe('hello world');
    });

    test('should remove only 2 leading spaces if only 2 exist', () => {
      domManager.textarea!.value = '  hello world';
      domManager.textarea!.selectionStart = 2;
      domManager.textarea!.selectionEnd = 2;

      domManager.outdentAtCursor();

      expect(domManager.textarea!.value).toBe('hello world');
    });

    test('should do nothing if no leading whitespace', () => {
      domManager.textarea!.value = 'hello world';
      domManager.textarea!.selectionStart = 5;
      domManager.textarea!.selectionEnd = 5;

      domManager.outdentAtCursor();

      expect(domManager.textarea!.value).toBe('hello world');
    });

    test('should outdent multiple selected lines', () => {
      domManager.textarea!.value = '\tline1\n    line2\n  line3';
      domManager.textarea!.selectionStart = 0;
      domManager.textarea!.selectionEnd = domManager.textarea!.value.length;

      domManager.outdentAtCursor();

      expect(domManager.textarea!.value).toBe('line1\nline2\nline3');
    });

    test('should outdent only lines with indentation in selection', () => {
      domManager.textarea!.value = '\tindented\nno indent\n    also indented';
      domManager.textarea!.selectionStart = 0;
      domManager.textarea!.selectionEnd = domManager.textarea!.value.length;

      domManager.outdentAtCursor();

      expect(domManager.textarea!.value).toBe('indented\nno indent\nalso indented');
    });

    test('should maintain cursor position after outdent', () => {
      domManager.textarea!.value = '\thello world';
      domManager.textarea!.selectionStart = 5;
      domManager.textarea!.selectionEnd = 5;

      domManager.outdentAtCursor();

      expect(domManager.textarea!.selectionStart).toBe(4);
      expect(domManager.textarea!.selectionEnd).toBe(4);
    });

    test('should maintain selection range after outdent', () => {
      domManager.textarea!.value = '\tline1\n\tline2';
      domManager.textarea!.selectionStart = 0;
      domManager.textarea!.selectionEnd = 13;

      domManager.outdentAtCursor();

      expect(domManager.textarea!.value).toBe('line1\nline2');
      expect(domManager.textarea!.selectionStart).toBe(0);
      expect(domManager.textarea!.selectionEnd).toBe(11);
    });

    test('should prefer removing tab over spaces', () => {
      domManager.textarea!.value = '\t    hello';
      domManager.textarea!.selectionStart = 1;
      domManager.textarea!.selectionEnd = 1;

      domManager.outdentAtCursor();

      expect(domManager.textarea!.value).toBe('    hello');
    });
  });
});