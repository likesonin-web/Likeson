// hooks/support/useTicketSearch.js

import { useState, useEffect, useRef, useCallback } from 'react';
import supportApi from '../../services/support/supportApi';
import { GLOBAL_SEARCH_DEBOUNCE_MS } from '../../features/support/constants/support.constants';

/**
 * Standalone instant-search hook for the global search bar (Cmd+K palette).
 * Distinct from useTicketFilters' `search` field: this hook hits the
 * dedicated related-entity-name aggregation endpoint and returns results
 * directly, rather than mutating the main ticket list's filter state.
 */
export function useTicketSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  const search = useCallback((term) => {
    setQuery(term);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!term || term.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      try {
        const data = await supportApi.searchByEntityName({ term: term.trim() });
        if (requestId === requestIdRef.current) {
          setResults(data.items || []);
          setError(null);
        }
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(err?.response?.data?.message || 'Search failed.');
          setResults([]);
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { query, results, loading, error, search, clear };
}

export default useTicketSearch;
