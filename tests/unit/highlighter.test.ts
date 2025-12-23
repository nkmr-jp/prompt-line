/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { FileSearchHighlighter } from '../../src/renderer/file-search/highlighter';
import type { FileSearchCallbacks } from '../../src/renderer/file-search/types';

describe('FileSearchHighlighter', () => {
  let highlighter: FileSearchHighlighter;
  let mockTextInput: { value: string; selectionStart: number; selectionEnd: number };
  let mockHighlightBackdrop: { textContent: string; innerHTML: string; scrollTop: number; scrollLeft: number };
  let mockCallbacks: FileSearchCallbacks;

  beforeEach(() => {
    mockTextInput = {
      value: '',
      selectionStart: 0,
      selectionEnd: 0
    };

    mockHighlightBackdrop = {
      textContent: '',
      innerHTML: '',
      scrollTop: 0,
      scrollLeft: 0
    };

    mockCallbacks = {
      getCursorPosition: jest.fn(() => mockTextInput.selectionStart),
      setCursorPosition: jest.fn(),
      getTextContent: jest.fn(() => mockTextInput.value),
      setTextContent: jest.fn((text: string) => { mockTextInput.value = text; }),
      replaceRangeWithUndo: jest.fn(),
      onFileSelected: jest.fn()
    };

    highlighter = new FileSearchHighlighter(
      () => mockTextInput as HTMLTextAreaElement,
      () => mockHighlightBackdrop as unknown as HTMLDivElement,
      mockCallbacks,
      () => null, // getCachedDirectoryData
      (fullPath: string, baseDir: string) => fullPath.replace(baseDir + '/', '')
    );
  });

  describe('findAtPathAtCursor', () => {
    // Helper to set up atPaths by calling rescanAtPaths with selectedPaths
    const setupAtPaths = (text: string, selectedPaths: string[]) => {
      mockTextInput.value = text;
      // Add paths to selectedPaths
      const selectedPathsSet = highlighter.getSelectedPaths();
      for (const path of selectedPaths) {
        selectedPathsSet.add(path);
      }
      // Rescan to populate atPaths
      highlighter.rescanAtPaths(text);
    };

    test('should return path when cursor is exactly at end of path (end of text)', () => {
      // Text: "@.github/" (9 chars), cursor at position 9 (after /)
      setupAtPaths('@.github/', ['.github/']);
      mockTextInput.selectionStart = 9;

      const result = highlighter.findAtPathAtCursor(9);

      expect(result).not.toBeNull();
      expect(result?.path).toBe('.github/');
    });

    test('should return path when cursor is after trailing space', () => {
      // Text: "@.github/ " (10 chars with trailing space), cursor at position 10
      setupAtPaths('@.github/ ', ['.github/']);
      mockTextInput.selectionStart = 10;

      const result = highlighter.findAtPathAtCursor(10);

      expect(result).not.toBeNull();
      expect(result?.path).toBe('.github/');
    });

    test('should NOT return path when cursor is at end+1 and there is another @ character', () => {
      // Text: "@.github/@" (10 chars), cursor at position 10 (after the second @)
      // The @.github/ path has end=9, and text[9]='@'
      // cursor (10) === path.end + 1 (10) is TRUE
      // But charAtEnd ('@') !== ' ', so should NOT return path
      setupAtPaths('@.github/@', ['.github/']);
      mockTextInput.selectionStart = 10;

      const result = highlighter.findAtPathAtCursor(10);

      // Bug fix: Should return null because there's another @ after the path
      expect(result).toBeNull();
    });

    test('should NOT return path when cursor is at end and there is another character', () => {
      // Text: "@.github/x" (10 chars), cursor at position 9 (at the 'x')
      // The @.github/ path has end=9, and text[9]='x'
      // cursor (9) === path.end (9) is TRUE
      // But charAtEnd ('x') !== undefined && charAtEnd !== ' ', so should NOT return path
      setupAtPaths('@.github/x', ['.github/']);
      mockTextInput.selectionStart = 9;

      const result = highlighter.findAtPathAtCursor(9);

      // Bug fix: Should return null because there's another character after the path
      expect(result).toBeNull();
    });

    test('should return null when no atPaths exist', () => {
      mockTextInput.value = 'some text';
      mockTextInput.selectionStart = 5;

      const result = highlighter.findAtPathAtCursor(5);

      expect(result).toBeNull();
    });

    test('should return null when cursor is in the middle of path', () => {
      // Text: "@.github/" (9 chars), cursor at position 5 (middle of path)
      setupAtPaths('@.github/', ['.github/']);
      mockTextInput.selectionStart = 5;

      const result = highlighter.findAtPathAtCursor(5);

      // Middle of path should not trigger deletion
      expect(result).toBeNull();
    });

    test('should return null when cursor is before path', () => {
      // Text: "hello @.github/" (15 chars), cursor at position 3
      setupAtPaths('hello @.github/', ['.github/']);
      mockTextInput.selectionStart = 3;

      const result = highlighter.findAtPathAtCursor(3);

      expect(result).toBeNull();
    });

    test('should handle multiple @paths in text', () => {
      // Text: "@src/ hello @.github/" (21 chars)
      // Two paths: @src/ (end=5) and @.github/ (end=21)
      setupAtPaths('@src/ hello @.github/', ['src/', '.github/']);

      // Cursor at end of first path (position 5)
      mockTextInput.selectionStart = 5;
      const result1 = highlighter.findAtPathAtCursor(5);
      expect(result1).not.toBeNull();
      expect(result1?.path).toBe('src/');

      // Cursor at end of second path (position 21)
      mockTextInput.selectionStart = 21;
      const result2 = highlighter.findAtPathAtCursor(21);
      expect(result2).not.toBeNull();
      expect(result2?.path).toBe('.github/');
    });

    test('bug scenario: @.github/@ should NOT delete @.github/ when backspace at end', () => {
      // This is the exact bug scenario from the user
      // Text: "@.github/@" (10 chars)
      // @.github/ occupies positions 0-8, end=9
      // Second @ is at position 9
      // Cursor is at position 10 (after second @)
      setupAtPaths('@.github/@', ['.github/']);
      mockTextInput.selectionStart = 10;

      // When user presses backspace at position 10:
      // findAtPathAtCursor should return null
      // So browser default backspace deletes just the '@' at position 9
      const result = highlighter.findAtPathAtCursor(10);

      // Should NOT find a path, so backspace only deletes the single '@'
      expect(result).toBeNull();
    });
  });
});
