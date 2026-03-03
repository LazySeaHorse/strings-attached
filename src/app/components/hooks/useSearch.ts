import { useState, useCallback, useMemo, useEffect } from 'react';

export interface SearchMatch {
  index: number;
  start: number;
  end: number;
  text: string;
}

export function useSearch(content: string) {
  const [query, setQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  const matches = useMemo<SearchMatch[]>(() => {
    if (!query || query.length < 2) return [];

    const results: SearchMatch[] = [];
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let start = 0;

    while (true) {
      const idx = lowerContent.indexOf(lowerQuery, start);
      if (idx === -1) break;
      results.push({
        index: results.length,
        start: idx,
        end: idx + query.length,
        text: content.slice(idx, idx + query.length),
      });
      start = idx + 1;
    }

    return results;
  }, [content, query]);

  // Reset match index when matches change
  useEffect(() => {
    if (currentMatchIdx >= matches.length) {
      setCurrentMatchIdx(0);
    }
  }, [matches.length, currentMatchIdx]);

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIdx((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIdx((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const clear = useCallback(() => {
    setQuery('');
    setCurrentMatchIdx(0);
  }, []);

  return {
    query,
    setQuery,
    matches,
    currentMatchIdx,
    currentMatch: matches[currentMatchIdx] ?? null,
    nextMatch,
    prevMatch,
    clear,
    totalMatches: matches.length,
  };
}
