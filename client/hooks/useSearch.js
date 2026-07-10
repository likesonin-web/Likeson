// src/hooks/useSearch.js
'use client';
import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useDebounce } from './useDebounce';
import { searchMessages, clearSearchResults } from '@/store/slices/messageSlice';

export function useSearch(conversationId) {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 350);

  const search = useCallback((q) => {
    if (!q?.trim()) {
      dispatch(clearSearchResults(conversationId));
      return;
    }
    dispatch(searchMessages({ conversationId, q: q.trim() }));
  }, [dispatch, conversationId]);

  return { query, setQuery, debouncedQuery, search };
}
