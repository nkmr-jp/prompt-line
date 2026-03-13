import { describe, it, expect } from 'vitest';
import { findAllAgentSkills, findAgentSkillAtPosition, findAgentSkillAtCursor } from '../../src/renderer/mentions/text-finder';

describe('findAllAgentSkills', () => {
  describe('default trigger prefix (/)', () => {
    it('should find simple agent skills', () => {
      const results = findAllAgentSkills('/commit');
      expect(results).toEqual([{ command: 'commit', start: 0, end: 7 }]);
    });

    it('should find agent skills after whitespace', () => {
      const results = findAllAgentSkills('hello /help');
      expect(results).toEqual([{ command: 'help', start: 6, end: 11 }]);
    });

    it('should find multiple agent skills', () => {
      const results = findAllAgentSkills('/commit /help');
      expect(results).toHaveLength(2);
      expect(results[0]!.command).toBe('commit');
      expect(results[1]!.command).toBe('help');
    });

    it('should not match / in paths', () => {
      const results = findAllAgentSkills('ghq/github.com');
      expect(results).toHaveLength(0);
    });

    it('should find multi-word commands with known names', () => {
      const results = findAllAgentSkills('/Linear API', ['Linear API']);
      expect(results).toEqual([{ command: 'Linear API', start: 0, end: 11 }]);
    });
  });

  describe('$ trigger prefix', () => {
    it('should find agent skills with $ prefix', () => {
      const results = findAllAgentSkills('$commit', undefined, ['$']);
      expect(results).toEqual([{ command: 'commit', start: 0, end: 7 }]);
    });

    it('should find $ agent skills after whitespace', () => {
      const results = findAllAgentSkills('hello $help', undefined, ['$']);
      expect(results).toEqual([{ command: 'help', start: 6, end: 11 }]);
    });

    it('should not match $ in middle of word', () => {
      const results = findAllAgentSkills('price$value', undefined, ['$']);
      expect(results).toHaveLength(0);
    });

    it('should find multi-word commands with $ prefix', () => {
      const results = findAllAgentSkills('$Linear API', ['Linear API'], ['$']);
      expect(results).toEqual([{ command: 'Linear API', start: 0, end: 11 }]);
    });
  });

  describe('multiple trigger prefixes (/ and $)', () => {
    const prefixes = ['/', '$'];

    it('should find both / and $ prefixed skills', () => {
      const results = findAllAgentSkills('/commit $help', undefined, prefixes);
      expect(results).toHaveLength(2);
      expect(results[0]!.command).toBe('commit');
      expect(results[1]!.command).toBe('help');
    });

    it('should find $ skill at start and / skill after space', () => {
      const results = findAllAgentSkills('$review /commit', undefined, prefixes);
      expect(results).toHaveLength(2);
      expect(results[0]!.command).toBe('review');
      expect(results[1]!.command).toBe('commit');
    });

    it('should find multi-word commands with both prefixes', () => {
      const results = findAllAgentSkills('/Linear API $Linear API', ['Linear API'], prefixes);
      expect(results).toHaveLength(2);
    });
  });

  describe('backward compatibility', () => {
    it('should default to / when triggerPrefixes is undefined', () => {
      const results = findAllAgentSkills('/commit');
      expect(results).toHaveLength(1);
    });

    it('should default to / when triggerPrefixes is empty', () => {
      const results = findAllAgentSkills('/commit', undefined, []);
      expect(results).toHaveLength(1);
    });

    it('should not find $ when triggerPrefixes is not provided', () => {
      const results = findAllAgentSkills('$commit');
      expect(results).toHaveLength(0);
    });
  });
});

describe('findAgentSkillAtPosition', () => {
  it('should find $ skill at cursor position', () => {
    const result = findAgentSkillAtPosition('$commit', 3, undefined, ['$']);
    expect(result).not.toBeNull();
    expect(result!.command).toBe('commit');
  });

  it('should return null when cursor not on skill', () => {
    const result = findAgentSkillAtPosition('hello $commit', 3, undefined, ['$']);
    expect(result).toBeNull();
  });
});

describe('findAgentSkillAtCursor', () => {
  it('should find $ skill at cursor end position', () => {
    const result = findAgentSkillAtCursor('$commit ', 8, ['commit'], ['$']);
    expect(result).not.toBeNull();
    expect(result!.command).toBe('commit');
  });

  it('should return null for unknown $ command', () => {
    const result = findAgentSkillAtCursor('$unknown ', 9, ['commit'], ['$']);
    expect(result).toBeNull();
  });
});
