/**
 * Split a search query into normalized lowercase keywords.
 * Fast-paths the single-word case to avoid regex overhead.
 * Supports both ASCII space and full-width space (U+3000) for Japanese input.
 *
 * Shared by both main and renderer processes.
 */
const WHITESPACE_PATTERN = /[\s\u3000]+/;

export function splitKeywords(query: string): string[] {
  // Fast-path: no whitespace characters at all
  if (!WHITESPACE_PATTERN.test(query)) {
    return query.length > 0 ? [query] : [];
  }
  return query.split(WHITESPACE_PATTERN).filter(k => k.length > 0);
}
