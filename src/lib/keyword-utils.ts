/**
 * Split a search query into normalized lowercase keywords.
 * Fast-paths the single-word case to avoid regex overhead.
 *
 * Shared by both main and renderer processes.
 */
export function splitKeywords(query: string): string[] {
  if (query.indexOf(' ') === -1) {
    return query.length > 0 ? [query] : [];
  }
  return query.split(/\s+/).filter(k => k.length > 0);
}
